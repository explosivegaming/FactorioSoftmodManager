const config = require('../config.json')

const request = require('request')
const requestDatabase = request.defaults({baseUrl:config.serverURL})

const unzip = require('unzip')
const fs = require('fs-extra')
const consoleLog = require('./consoleLog')
const valid = require('./valid')
const semver = require('semver')

const rootDir = process.env.dir

const jsonChache = {}
class Softmod {
    constructor(name,versionQurey) {
        this.name = name
        this.versionQurey = versionQurey
        this.downloadPath = `${rootDir+config.modulesDir}/${this.name.replace(/\./gi,'/')}`
    }

    static get jsonChache() {
        return jsonChache
    }

    static fromJson(json,nameOverride) {
        const softmod = new Softmod(nameOverride ? nameOverride : json.name,json.version)
        softmod._json = json
        softmod.updateFromJson()
        return softmod
    }

    static async saveJson(name,versionQurey,path) {
        const softmod = new this(name,versionQurey)
        const json = await softmod.getJson()
        fs.writeJSONSync(path,json)
    }

    static extractVersionFromName(name,returnName) {
        let softmodName = name
        let softmodVersion = '*'
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

    install(skip=[]) {
        if (this.installed && !process.env.useForce) return
        if (skip.includes(this.name)) return
        consoleLog('start','Installing softmod: '+this.versionName)
        return new Promise(async (resolve,reject) => {
            if (!this.location) await this.updateFromJson()
            if (!this.location) reject('No location for module download')
            else {
                console.log(1)
                await this.downloadPackage()
                console.log(2)
                this.copyLocale()
                console.log(3)
                await Promise.all(this.dependencies.map(softmod => softmod.install(skip)).concat(this.submodules.map(softmod => softmod.install(skip))))
                consoleLog('success','Installed softmod: '+this.versionName)
                resolve()
            }
        }).catch(err => consoleLog('error',err))
    }
    
    async copyLocale() {
        function recur(dir) {
            return new Promise((resolve,reject) => {
                fs.readdir(dir,(err,files) => {
                    if (err) reject(err)
                    else {
                        files.forEach(file => {
                            if (fs.statSync(`${dir}/${file}`).isDirectory()) recur.apply(this,[`${dir}/${file}`])
                            else {
                                if (file.includes('.cfg')) fs.copy(`${dir}/${file}`,`${rootDir+config.localeDir}/${this.name}.cfg`,{overwrite:process.env.useForce})
                            }
                        })
                        resolve()
                    }
                })
            }).catch(err => {
                if (!err.message.includes('ENOENT')) consoleLog('error',err)
            })
        }
        await recur.apply(this,[this.downloadPath+config.localeDir])
        await Promise.all(fs.readdirSync(this.downloadPath).map(file => {
            if (fs.statSync(`${this.downloadPath}/${file}`).isDirectory()) {
                return new Softmod(`${this.name}.${file}`,this.versionQurey).copyLocale()
            }
        })).catch(err => consoleLog('error',err))
    }

    downloadPackage() {
        consoleLog('info','Downloading package for: '+this.versionName)
        function download() {
            return new Promise(async (resolve,reject) => {
                try {
                    console.log(8)
                    await fs.emptyDir(this.downloadPath)
                    console.log(9)
                    const requestSent = request(this.location)
                        .on('error',err => reject('Request Error: '+err))
                    const extract = unzip.Extract({path:this.downloadPath})
                        .on('error',err => reject('Unzip Error: '+err))
                    requestSent.pipe(extract)
                    .on('error',err => reject('Pipe Error: '+err))
                    .on('finish',async () => {
                        console.log(4)
                        if (this._json) fs.writeJSONSync(this.downloadPath+config.jsonFile,this._json)
                        if (this.parent) {
                            const [parentName,parentVersion] = Softmod.extractVersionFromName(this.parent,true)
                            await Softmod.saveJson(parentName,parentVersion,this.downloadPath+'/..'+config.jsonFile)
                        }
                        consoleLog('info','Downloaded package for: '+this.versionName)
                        resolve()
                    })
                    console.log(10)
                } catch (err) {
                    reject('Download Error: '+err)
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
                    console.log(5)
                    while (!success && ctn < 10) {
                        console.log(6)
                        ctn++
                        success = true
                        await download.apply(this)
                        .catch(err => {
                            console.log(11)
                            if (ctn == 10) reject(err)
                            success = false
                        })
                        console.log(7)
                    }
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
        this.type = json.type
        this.version=semver.clean(json.version)
        this.description=json.description
        this.location=json.location
        this.parent=json.collection
        this.requires=json.dependencies
        this.provides=json.submodules
    }

    validate(noOverwrite=false) {
        // needs re doing for class
    }

    get installed() {
        const downloadPath = `${rootDir+config.modulesDir}/${this.name.replace(/\./gi,'/')}`
        if (!fs.existsSync(downloadPath+config.jsonFile)) return false
        const json = fs.readJSONSync(downloadPath+config.jsonFile)
        if (!json && json.version) return false
        if (this.version) {
            return semver.eq(json.version,this.version)
        } else {
            return semver.satisfies(json.version,this.versionQurey.replace('?',''))
        }
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