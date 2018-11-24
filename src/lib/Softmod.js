const config = require('../config.json')

const request = require('request')
const requestDatabase = request.defaults({baseUrl:config.serverURL})

const unzip = require('unzip')
const fs = require('fs-extra')
const consoleLog = require('./consoleLog')
const valid = require('./valid')
const semver = require('semver')

const rootDir = process.env.dir

class Softmod {
    constructor(name,versionQurey) {
        this.name = name
        this.versionQurey = versionQurey
    }

    static fromJson(json) {
        const softmod = this.bind({_json:json},[json.name,json.version])
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

    install(skip={}) {
        if (this.installed) return
        consoleLog('start','Installing softmod: '+this.versionName)
        return new Promise(async (resolve,reject) => {
            if (!this.location) await this.updateFromJson()
            if (!this.location) reject('No location for module download')
            else {
                await this.downloadPackage()
                await Promise.all(this.dependencies.map(softmod => softmod.install(skip)))
                consoleLog('success','Installed softmod: '+this.versionName)
                resolve()
            }
        }).catch(err => consoleLog('error',err))
    }
    
    downloadPackage() {
        consoleLog('info','Downloading package for: '+this.versionName)
        return new Promise(async (resolve,reject) => {
            if (this.installed) reject(this.versionName+' already installed')
            else {
                if (!this.location) await this.updateFromJson()
                if (!this.location) reject('No location for module download')
                else {
                    const downloadPath = `${rootDir+config.modulesDir}/${this.name.replace(/\./gi,'/')}`
                    await fs.emptyDir(downloadPath)
                    request(this.location)
                    .on('error',err => reject(err))
                    .pipe(unzip.Extract({path:downloadPath}))
                    .on('error',err => reject(err))
                    .on('finish',async () => {
                        if (this._json) fs.writeJSONSync(downloadPath+config.jsonFile,this._json)
                        if (this.parent) {
                            const [parentName,parentVersion] = Softmod.extractVersionFromName(this.parent,true)
                            await Softmod.saveJson(parentName,parentVersion,downloadPath+'/..'+config.jsonFile)
                        }
                        consoleLog('info','Downloaded package for: '+this.versionName)
                        resolve()
                    })
                }
            }
        }).catch(err => consoleLog('error',err))
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
                    fs.writeJSONSync(downloadPath,body.json)
                    resolve(downloadPath)
                }
            })
        }).catch(err => consoleLog('error',err))
    }

    async getJson() {
        if (!this._json) {
            const jsonFile = await this.downloadJson()
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
                rtn.push(new Softmod(softmodName,this.provides[softmodName]))
            }
        }
        return rtn
    }
}

module.exports = Softmod