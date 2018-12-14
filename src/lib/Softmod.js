const config = require('../config.json')

const request = require('request')
const requestDatabase = request.defaults({baseUrl:config.serverURL})

const unzipper = require('unzip')
const fs = require('fs-extra')
const {consoleLog,errorLog,finaliseLog} = require('./consoleLog')
const semver = require('semver')

const rootDir = process.env.dir

const jsonChache = {}
const installChache = []
class Softmod {
    constructor(name,versionQurey='*',isScenario=false) {
        this.name = name
        this.versionQurey = versionQurey
        this.isScenario = isScenario // this will cause the download path to be made
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
        softmod.json = json
        softmod.updateFromJsonSync()
        return softmod
    }

    // will save a copy of a softmod json into any dir
    static async saveJson(name,versionQurey,path) {
        const softmod = new this(name,versionQurey)
        const json = await softmod.getJson()
        fs.writeJSONSync(path,json,{spaces:2})
    }

    // takes a softmod name and returns the version number, or the name (with version removed) and version number
    static extractVersionFromName(name,returnName) {
        let softmodName = name
        let softmodVersion = '*'
        // allows either @ or _ to be a seperator
        if (name.includes('_')) {
            softmodName = name.substring(0,name.lastIndexOf('_'))
            softmodVersion = name.substring(name.lastIndexOf('_')+1)
        } else if (name.includes('@')) {
            softmodName = name.substring(0,name.lastIndexOf('@'))
            softmodVersion = name.substring(name.lastIndexOf('@')+1)
        }
        if (returnName) return [softmodName,softmodVersion]
        else return softmodVersion
    }

    async copyLocale() {
        if (this.isScenario) return
        function recur(dir,dirName) {
            return new Promise((resolve,reject) => {
                fs.readdir(dir,(err,files) => {
                    if (err) reject(err)
                    else {
                        for (let i=0;i<files.length;i++) {
                            const file = files[i]
                            if (fs.statSync(`${dir}/${file}`).isDirectory() && !fs.existsSync(`${dir}/${file}/${config.jsonFile}`)) recur.apply(this,[`${dir}/${file}`,file])
                            else {
                                if (file.includes('.cfg')) {
                                    let lang = dirName
                                    if (dirName == config.localeDir) lang = file.replace('.cfg','')
                                    try {
                                        fs.copy(`${dir}/${file}`,`${rootDir+config.localeDir}/${lang}/${this.name}.cfg`,{overwrite:process.env.useForce})
                                        .catch(errorLog)
                                    } catch (err) {
                                        consoleLog('error',err)
                                    }
                                }
                            }
                        }
                        resolve()
                    }
                }).catch(reject)
            }).catch(err => {
                if (!err.code == 'ENOENT') consoleLog('error',err)
            })
        }
        await recur.apply(this,[this.downloadPath+config.localeDir,config.localeDir])
        // idk what this was for as modules copy they own locales apon installing
        /*await Promise.all(fs.readdirSync(this.downloadPath).map(file => {
            if (!file.includes('.zip') && fs.statSync(`${this.downloadPath}/${file}`).isDirectory()) {
                return new Softmod(`${this.name}.${file}`,this.versionQurey).copyLocale()
            }
        })).catch(errorLog)*/
    }

    async build(save=true,bak=false,skipRead=false) {
        // regradless of force it will not install if it is mark to be skiped or has been installed this sesion
        if (Softmod.installChache.includes(this.name)) return
        installChache.push(this.name)
        // makes sure that the json is loaded
        if (!skipRead) await this.readJson(true)
        consoleLog('start','Building json for: '+this.versionName)
        // awaits all actions on json
        await Promise.all([this.updateCollection(true),this.udpateProvides(true),this.updateRequires(true)])
        if (this.json.type) delete this.json.type
        if (save) await this.writeJson(bak)
        consoleLog('success',`Json for ${this.versionName} has been built.`)
    }

    // uninstalls the softmod and dependices
    uninstall(recur=false,skip=[]) {
        // if it is already installed then it is not reinstalled unless force is used
        if (!this.installed && !process.env.useForce) return
        // regradless of force it will not install if it is mark to be skiped or has been installed this sesion
        if (skip.includes(this.name) || Softmod.installChache.includes(this.name)) return
        installChache.push(this.name)
        // starts uninstall process
        consoleLog('start','Uninstalling softmod: '+this.versionName)
        return new Promise(async (resolve,reject) => {
            await this.readJson(true)
            let promises = []
            if (recur) {
                promises=promises.concat(this.dependencies.map(softmod => softmod.uninstall(true,skip)))
                .concat(this.submodules.map(softmod => softmod.uninstall(true,skip)))
                if (this.collection) promises.push(this.collection.uninstall(false,skip))
            }
            await Promise.all(promises)
            if (!this.isScenario) fs.removeSync(this.downloadPath)
            consoleLog('success','Uninstalled softmod: '+this.versionName)
            resolve()
        }).catch(errorLog)
    }

    // installs the softmod
    install(recur=true,skip=[]) {
        // if it is already installed then it is not reinstalled unless force is used
        if (this.installed && !process.env.useForce) return
        // regradless of force it will not install if it is mark to be skiped or has been installed this sesion
        if (skip.includes(this.name) || Softmod.installChache.includes(this.name)) return
        installChache.push(this.name)
        // starts install process
        consoleLog('start','Installing softmod: '+this.versionName)
        return new Promise(async (resolve,reject) => {
            if (!this.location) await this.updateFromJson()
            if (!this.location && !this.isScenario) reject('No location for module download')
            else {
                await this.downloadPackage()
                await this.copyLocale() // causes some bugs for some reason, EBUSY
                let promises = this.dependencies.map(softmod => softmod.install(true,skip))
                if (this.collection) promises.push(this.collection.install(false,skip))
                if (recur) promises = promises.concat(this.submodules.map(softmod => softmod.install(true,skip)))
                await Promise.all(promises)
                consoleLog('success','Installed softmod: '+this.versionName)
                resolve()
            }
        }).catch(errorLog)
    }

    downloadPackage() {
        if (this.isScenario) return
        consoleLog('info','Downloading package for: '+this.versionName)
        const download = () => {
            return new Promise(async (resolve,reject) => {
                const zipPath = `${this.downloadPath}/${this.name}.zip`
                try {
                    await fs.emptyDir(this.downloadPath).catch(reject)
                    let url = this.location
                    if (url == 'FSM_ARCHIVE') url = `${config.serverURL}/archive/${this.name}_${this.version}`
                    request(url)
                    .on('error',err => reject('Request Error: '+err))
                    .pipe(fs.createWriteStream(zipPath))
                    .on('finish',() => {
                        fs.createReadStream(zipPath)
                        .on('error',err => reject('Read Stream Error: '+err))
                        .pipe(unzipper.Extract({ path: this.downloadPath}))
                        .on('error',err => reject('Extract Pipe Error: '+err))
                        .on('close',async () => {
                            if (this.json) fs.writeJsonSync(this.downloadPath+config.jsonFile,this.json,{spaces:2,throws:false})
                            consoleLog('info','Downloaded package for: '+this.versionName)
                            resolve()
                        })
                    })
                    .on('error',err => reject('Download Pipe Error: '+err))
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
                    while (!success && ctn < 10) {
                        ctn++
                        await download.apply(this)
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
            requestDatabase.get(`/softmod/${this.name}/versions?v=${this.versionQurey}`,{json:true},(err,res,body) => {
                if (err) reject(err)
                else {
                    const lastest = body[this.name+'@latest']
                    if (!lastest) {
                        reject('Could not download json for: '+this.versionName)
                        return
                    }
                    consoleLog('info',`Downloaded json for: ${this.name}@${lastest.version}`)
                    const downloadPath = `${rootDir+config.jsonDir}/${this.name}_${lastest.version}.json`
                    Softmod.jsonChache[`${this.name}@${lastest.version}`] = downloadPath
                    Softmod.jsonChache[`${this.name}@${this.versionQurey}`] = downloadPath
                    fs.writeJSONSync(downloadPath,lastest)
                    this.json = lastest
                    resolve(downloadPath)
                }
            })
        }).catch(errorLog)
    }

    readJson(update) {
        return fs.readJSON(this.downloadPath+config.jsonFile,{throws:false}).then(json => {
            if (json && update) {
                this.json = json
                this.updateFromJsonSync()
                return json
            }
        }).catch(err => {
            if (!err.code == 'ENOENT') consoleLog('error',err)
        })
    }

    writeJson(bak=false) {
        return new Promise(async (resolve,reject) => {
            if (bak) {
                fs.rename(this.downloadPath+config.jsonFile,this.downloadPath+config.jsonFile+'.bak',async err => {
                    if (err) reject(err)
                    else {
                        await fs.writeJSON(this.downloadPath+config.jsonFile,this.json,{spaces:2}).catch(reject)
                        resolve()
                    }
                })
            } else {
                await fs.writeJSON(this.downloadPath+config.jsonFile,this.json,{spaces:2}).catch(reject)
                resolve()
            }
        })
    }

    // get json will download the json file if download is allowed; if download fails or is disabled then it will read the json file
    // it may also read the json from the download chache first
    async getJson() {
        if (!this.json) {
            let jsonFile = Softmod.jsonChache[this.versionName]
            if (!fs.existsSync(jsonFile) && process.env.download) jsonFile = await this.downloadJson()
            if (!jsonFile || !process.env.download) jsonFile = this.downloadPath+config.jsonFile
            this.json = fs.readJSONSync(jsonFile,{throws:false})
        }
        return this.json
    }

    async updateFromJson() {
        const json = await this.getJson()
        if (!json || !json.version) return this
        this.version=semver.clean(json.version)
        this.location=json.location
        this.parent=json.collection
        this.requires=json.dependencies || {}
        this.provides=json.submodules || json.softmods || {}
        if (json.softmods) {this.isScenario=true;this.name=json.name} // scenario checker
        // this is some migration code to remove objects from submodules
        for (let key in this.provides) {
            if (typeof this.provides[key] == 'object') {
                this.provides[`${this.name}.${key}`]=this.provides[key].version
                delete this.provides[key]
            }
        }
        return this
    }

    updateFromJsonSync() {
        const json = this.json
        if (!json || !json.version) return this
        this.version=semver.clean(json.version)
        this.location=json.location
        this.parent=json.collection
        this.requires=json.dependencies || {}
        this.provides=json.submodules || json.softmods || {}
        if (json.softmods) {this.isScenario=true;this.name=json.name} // scenario checker
        // this is some migration code to remove objects from submodules
        for (let key in this.provides) {
            if (typeof this.provides[key] == 'object') {
                this.provides[`${this.name}.${key}`]=this.provides[key].version
                delete this.provides[key]
            }
        }
        return this
    }

    jsonValue(key) {
        return this.json && this.json[key] || this[key]
    }

    async updateCollection(saveToJson=false) {
        if (this.isScenario) return
        // reads the name of the above dir to check for a parent
        const partentPath = this.downloadPath.substring(0,this.downloadPath.lastIndexOf('/'))
        if (partentPath != rootDir+config.modulesDir) {
            // the parent dir is not the module dir, so this is a sub module
            const parentName = partentPath.substring(partentPath.indexOf(config.modulesDir+'/')+config.modulesDir.length+1).replace('/','.')
            const softmod = new Softmod(parentName)
            await softmod.readJson(true)
            consoleLog('info',`Detected collection: ${softmod.versionName} for ${this.versionName}`)
            this.parent = `${parentName}@${softmod.version}`
            if (saveToJson && this.json) {
                this.json.collection = this.parent
                this.json.name=this.name
            }
            return this.collection
        }
    }

    udpateProvides(saveToJson=false) {
        // reads the current dir and checks for submodules
        return new Promise((resolve,reject) => {
            const submodules = this.provides || {}
            fs.readdir(this.downloadPath,async (err,files) => {
                if (err) reject(err)
                else {
                    for (let i=0;i<files.length;i++) {
                        const file = files[i]
                        if (fs.statSync(`${this.downloadPath}/${file}`).isDirectory()) {
                            const submod = this.isScenario ? new Softmod(file) : new Softmod(`${this.name}.${file}`)
                            const json = await submod.readJson(true)
                            if (json) {
                                // if it is a directory and has a moudle json file
                                consoleLog('info',`Detected submodule: ${submod.versionName} for ${this.versionName}`)
                                submodules[submod.name] = submod.version
                            }
                        }
                    }
                    if (Object.keys(submodules).length > 0) this.provides = submodules
                    if (saveToJson && this.json) {
                        if (this.isScenario) this.json.softmods = this.provides
                        else this.json.submodules = this.provides
                    }
                    // this is some migration code to remove objects from submodules
                    for (let key in this.provides) {
                        if (typeof this.provides[key] == 'object') {
                            this.provides[`${this.name}.${key}`]=this.provides[key].version
                            delete this.provides[key]
                        }
                    }
                    resolve(this.provides)
                }
            })
        }).catch(errorLog)
    }

    updateRequires(saveToJson=false) {
        if (this.isScenario) return
        // reads the control.lua and gets the installed versions for required modules
        return new Promise((resolve,reject) => {
            const regex = /(?:local \w+\s*=\s*require\('([^@]+?)(?:@([\^?<>=]+?\d\.\d\.\d))?'\))|(?:if loaded_modules\['([^@]+?)(?:@([\^?<>=]+?\d\.\d\.\d))?'\] then)/g
            // Regex breakdown: (1) capture for required module name (2) capture for required module version if present (3) capture for opt module name (4) capture for opt module version if present
            const dependencies = this.requires || {}
            fs.readFile(this.downloadPath+config.luaFile,async (err,data) => {
                if (err) {
                    if (err.code == 'ENOENT') resolve()
                    else reject(err)
                } else {
                    const promises = []
                    data = data.toString().replace(regex,(fm,m1,m2,m3,m4) => {
                        promises.push(new Promise(async (resolve) => {
                            const prefix = m3 && '?' || ''
                            const moduleName = m1 || m3
                            const moduleVersion = m2 || m4
                            if (moduleVersion) {
                                dependencies[moduleName] = moduleVersion
                                consoleLog('info',`Detected dependency: ${moduleName}@${moduleVersion} for ${this.versionName}`)
                            } else {
                                // if version not present then will get the currently installed version
                                const dep = new Softmod(moduleName)
                                const json = await dep.readJson(true)
                                if (json) {
                                    dependencies[moduleName] = prefix+'^'+dep.version
                                    consoleLog('info',`Detected dependency: ${moduleName}@${prefix}^${dep.version} for ${this.versionName}`)
                                } else {
                                    dependencies[moduleName] = prefix+'*'
                                    consoleLog('info',`Detected dependency: ${moduleName}@${prefix}* for ${this.versionName}`)
                                }
                            }
                            resolve()
                        }).catch(errorLog))
                    })
                    await Promise.all(promises)
                    if (Object.keys(dependencies).length > 0) this.requires = dependencies
                    if (saveToJson && this.json) this.json.dependencies = this.requires
                    resolve(this.requires)
                }
            })
        }).catch(errorLog)
    }

    incrementVeresion(versionType,saveToJson=false,bak=false) {
        const oldName = this.versionName
        this.version = semver.inc(this.version,versionType)
        consoleLog('info',oldName+' => '+this.versionName)
        if (saveToJson && this.json) {
            this.json.version = this.version 
            return this.writeJson(bak)
        }
    }

    get installed() {
        try {
            const downloadPath = `${rootDir+config.modulesDir}/${this.name.replace(/\./gi,'/')}`
            if (!fs.existsSync(downloadPath+config.jsonFile)) return false
            const json = fs.readJSONSync(downloadPath+config.jsonFile,{throws:false})
            if (!json || !json.version) return false
            return true
        } catch(err) {
            errorLog(err)
        }
    }

    get versionName() {
        return `${this.name}@${this.version ? this.version : this.versionQurey}`
    }

    get collection() {
        if (this.parent) {
            const [parentName,parentVersion] = Softmod.extractVersionFromName(this.parent,true)
            const parent = new Softmod(parentName,parentVersion)
            return parent
        }
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

    get isScenario() {
        if (this.json && this.json.softmods) return true
        return this._isScenario
    }

    set isScenario(value) {
        if (value) {
            this._isScenario = true
            this.downloadPath = rootDir+config.modulesDir
        } else {
            this._isScenario = false
            this.downloadPath = `${rootDir+config.modulesDir}/${this.name.replace(/\./gi,'/')}`
        }
    }
}

module.exports = Softmod