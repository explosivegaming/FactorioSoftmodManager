const config = require('../config.json')

const request = require('request')
const requestDatabase = request.defaults({baseUrl:config.serverURL})

const unzipper = require('unzip')
const fs = require('fs-extra')
const consoleLog = require('./consoleLog')
const valid = require('./valid')
const semver = require('semver')

const rootDir = process.env.dir

const jsonChache = {}
const installChache = []
class Softmod {
    constructor(name,versionQurey='*') {
        this.name = name
        this.versionQurey = versionQurey
        this.downloadPath = `${rootDir+config.modulesDir}/${this.name.replace(/\./gi,'/')}`
    }

    static get jsonChache() {
        return jsonChache
    }

    static get installChache() {
        return installChache
    }

    // creates a Softmod from a json object, oppional override for name
    static fromJson(json,nameOverride) {
        const softmod = new Softmod(nameOverride ? nameOverride : json.name,json.version)
        softmod._json = json
        softmod.updateFromJson()
        return softmod
    }

    // will save a copy of a softmod json into any dir
    static async saveJson(name,versionQurey,path) {
        const softmod = new this(name,versionQurey)
        const json = await softmod.getJson()
        fs.writeJSONSync(path,json)
    }

    // takes a softmod name and returns the version number, or the name (with version removed) and version number
    static extractVersionFromName(name,returnName) {
        let softmodName = name
        let softmodVersion = '*'
        // allows either @ or _ to be a seperator
        if (name.lastIndexOf('_') > 0) {
            softmodName = name.substring(0,name.lastIndexOf('_'))
            softmodVersion = name.substring(name.lastIndexOf('_')+1)
        } else if (name.lastIndexOf('@') > 0) {
            softmodName = name.substring(0,name.lastIndexOf('@'))
            softmodVersion = name.substring(name.lastIndexOf('@')+1)
        }
        if (returnName) return [softmodName,softmodVersion]
        else return softmodVersion
    }

    // installs the softmod
    install(skip=[]) {
        // if it is already installed then it is not reinstalled unless force is used
        if (this.installed && !process.env.useForce) return
        // regradless of force it will not install if it is mark to be skiped or has been installed this sesion
        if (skip.includes(this.name) || Softmod.installChache.includes(this.name)) return
        installChache.push(this.name)
        // starts install process
        consoleLog('start','Installing softmod: '+this.versionName)
        return new Promise(async (resolve,reject) => {
            if (!this.location) await this.updateFromJson()
            if (!this.location) reject('No location for module download')
            else {
                await this.downloadPackage()
                this.copyLocale()
                await Promise.all(this.dependencies.map(softmod => softmod.install(skip)).concat(this.submodules.map(softmod => softmod.install(skip))))
                consoleLog('success','Installed softmod: '+this.versionName)
                resolve()
            }
        }).catch(err => consoleLog('error',err))
    }
    
    async copyLocale() {
        function recur(dir,dirName) {
            return new Promise((resolve,reject) => {
                fs.readdir(dir,(err,files) => {
                    if (err) reject(err)
                    else {
                        files.forEach(file => {
                            if (fs.statSync(`${dir}/${file}`).isDirectory()) recur.apply(this,[`${dir}/${file}`,file])
                            else {
                                if (file.includes('.cfg')) {
                                    let lang = dirName
                                    if (dirName == config.localeDir) lang = file.replace('.cfg','')
                                    fs.copy(`${dir}/${file}`,`${rootDir+config.localeDir}/${lang}/${this.name}.cfg`,{overwrite:process.env.useForce})
                                }
                            }
                        })
                        resolve()
                    }
                })
            }).catch(err => {
                if (!err.message.includes('ENOENT')) consoleLog('error',err)
            })
        }
        await recur.apply(this,[this.downloadPath+config.localeDir,config.localeDir])
        await Promise.all(fs.readdirSync(this.downloadPath).map(file => {
            if (!file.includes('.zip') && fs.statSync(`${this.downloadPath}/${file}`).isDirectory()) {
                return new Softmod(`${this.name}.${file}`,this.versionQurey).copyLocale()
            }
        })).catch(err => consoleLog('error',err))
    }

    downloadPackage() {
        consoleLog('info','Downloading package for: '+this.versionName)
        const download = () => {
            return new Promise(async (resolve,reject) => {
                const zipPath = `${this.downloadPath}/${this.name}.zip`
                try {
                    await fs.emptyDir(this.downloadPath)
                    request(this.location)
                    .on('error',err => reject('Request Error: '+err))
                    .pipe(fs.createWriteStream(zipPath))
                    .on('finish',() => {
                        fs.createReadStream(zipPath)
                        .pipe(unzipper.Extract({ path: this.downloadPath}))
                        .on('error',err => reject('Pipe Error: '+err))
                        .on('finish',async () => {
                            if (this._json) fs.writeJSONSync(this.downloadPath+config.jsonFile,this._json)
                            if (this.parent) {
                                const [parentName,parentVersion] = Softmod.extractVersionFromName(this.parent,true)
                                await Softmod.saveJson(parentName,parentVersion,this.downloadPath+'/..'+config.jsonFile)
                            }
                            consoleLog('info','Downloaded package for: '+this.versionName)
                            resolve()
                        })
                    })
                } catch (err) {
                    reject('Download Error: '+err) // bugs be bugs stopped working again....
                }
            })
        }
        return new Promise(async (resolve,reject) => {
            if (this.installed && !process.env.useForce) reject(this.versionName+' already installed')
            else {
                if (!this.location) await this.updateFromJson()
                if (!this.location) reject('No location for module download')
                else {
                    let ctn = 0
                    let success = false
                    while (!success && ctn < 10) {
                        ctn++
                        await download.apply(this) //here
                        .catch(err => {
                            if (ctn == 10) reject(err)
                            success = false
                        })
                        .then(() => success = true)
                    }
                    if (!process.env.keepZips) fs.remove(`${this.downloadPath}/${this.name}.zip`)
                    resolve(ctn)
                }
            }
        }).catch(err => consoleLog('fail','Download Failed: '+err))
    }

    downloadJson() {
        return new Promise(async (resolve,reject) => {
            await fs.ensureDir(rootDir+config.jsonDir)
            // downloads json from database api and returns file path
            requestDatabase.get(`/package/${this.name}?version=${this.versionQurey}`,{json:true},(err,res,body) => {
                if (err) reject(err)
                else {
                    consoleLog('info',`Downloaded json for: ${this.name}@${body.latest}`)
                    const downloadPath = `${rootDir+config.jsonDir}/${this.name}_${body.latest}.json`
                    Softmod.jsonChache[`${this.name}@${body.latest}`] = downloadPath
                    Softmod.jsonChache[`${this.name}@${this.versionQurey}`] = downloadPath
                    fs.writeJSONSync(downloadPath,body.json)
                    resolve(downloadPath)
                }
            })
        }).catch(err => consoleLog('error',err))
    }

    async getJson() {
        if (!this._json) {
            let jsonFile = Softmod.jsonChache[this.versionName]
            if (!fs.existsSync(jsonFile)) jsonFile = await this.downloadJson()
            this._json = await fs.readJSON(jsonFile)
        }
        return this._json
    }

    async updateFromJson() {
        const json = await this.getJson()
        this.version=semver.clean(json.version)
        this.location=json.location
        this.parent=json.collection
        this.requires=json.dependencies || json.modules
        this.provides=json.submodules
        return this
    }

    jsonValue(key) {
        if (this._json) {
            return this._json[key]
        } else return this[key]
    }

    validate(noOverwrite=false) {
        // needs re doing for class
    }

    get installed() {
        const downloadPath = `${rootDir+config.modulesDir}/${this.name.replace(/\./gi,'/')}`
        if (!fs.existsSync(downloadPath+config.jsonFile)) return false
        const json = fs.readJSONSync(downloadPath+config.jsonFile)
        if (!json && json.version) return false
        /*if (this.version) {
            return semver.eq(json.version,this.version)
        } else {
            return semver.satisfies(json.version,this.versionQurey.replace('?',''))
        }*/
        return true
    }

    get versionName() {
        return `${this.name}@${this.version ? this.version : this.versionQurey}`
    }

    get dependencies() {
        const rtn = []
        if (this.requires) {
            for (let softmodName in this.requires) {
                rtn.push(new Softmod(softmodName,this.requires[softmodName]))
            }
        }
        return rtn
    }

    get submodules() {
        const rtn = []
        if (this.provides) {
            for (let softmodName in this.provides) {
                rtn.push(Softmod.fromJson(this.provides[softmodName],`${this.name}.${softmodName}`))
            }
        }
        return rtn
    }
}

module.exports = Softmod