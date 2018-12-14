const [consoleLog,errorLog] = require('./consoleLog')
const fs = require('fs-extra')
const Softmod = require('./Softmod')
const config = require('../config')

class LuaIndex {
    constructor() {
        this.modules = {}
    }

    contains(softmod) {
        return Object.keys(this.modules).includes(softmod.name)
    }

    async addSoftmod(softmod) {
        if (this.contains(softmod)) return
        await softmod.updateFromJson()
        if (softmod.installed) {
            if (softmod.installed) {
                consoleLog('info',`Added ${softmod.name} to the module index.`)
                index[softmod.name] = softmod
                await Promise.all(softmod.submodules.map(submod => this.addSoftmod(submod)))
            }
        }
    }

    readDir(dir) {
        return new Promise((resolve,reject) => {
            fs.readdir(dir).then(async files => {
                await Promise.all(files.map(file => {
                    if (fs.statSync(`${rootDir+config.modulesDir}/${file}`).isDirectory()) {
                        const softmodJson = fs.readJSONSync(`${rootDir+config.modulesDir}/${file}/${config.jsonFile}`,{throws:false})
                        if (softmodJson) {
                            const softmod = Softmod.fromJson(softmodJson)
                            return this.addSoftmod(softmod)
                        }
                    }
                }))
                resolve()
            }).catch(reject)
        }).catch(errorLog)
    }

    save(dir) {
        let output = ''
        Object.keys(this.modules).forEach(softmodName => {
            const softmod = this.modules[softmodName]
            output+=config.indexBody
                .replace('${module_name}',softmod.name)
                .replace('${module_path}',`.${config.modulesDir}/${softmod.name.replace(/\./gi,'/')}`)
                .replace('${deps}',softmod.dependencies.filter(dep => !dep.versionQurey.includes('?')).map(dep => `'${dep.name}'`))
        })
        return fs.writeFile(dir+config.modulesIndex,config.indexHeader+output+config.indexFooter).then(() => {
            consoleLog('info','Saved index.lua')
        }).catch(errorLog)
    }
}

module.exports = LuaIndex