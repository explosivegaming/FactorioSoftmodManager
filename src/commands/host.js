/*function moduleTemplate(name,version,json) {
    const version_parts = version.split('.')
    return {
        name: name,
        version: version,
        versionMajor: version_parts[0],
        versionMinor: version_parts[1],
        versionPatch: version_parts[2],
        json: json
    }
}

function updateCollection(index,collection) {
    const temp_col = moduleTemplate(collection.name,collection.version,collection)
    let includesModule_col = false
    index.forEach(value => {if (!includesModule_col && value.name == temp_col.name && value.version == temp_col.version) includesModule_col = true})
    if (!includesModule_col) index.push(temp_col)
    for (let module_name in collection.submodules) {
        const submodule = collection.submodules[module_name]
        if (valid.submodule(submodule)) {
            const temp = moduleTemplate(collection.name+'.'+submodule.name,submodule.version,submodule,true)
            let includesModule = false
            index.forEach(value => {if (!includesModule && value.name == temp.name && value.version == temp.version) includesModule = true})
            if (!includesModule) index.push(temp)
        }
    }
}

function applyUpdates(index) {
    new Promise(async (resolve,reject) => {
        for (let i = 0; i < index.length; i++) {
            const value = index[i]
            const rtn = new Promise(async (resolve2,reject2) => {
                const found = await database.ModuleJson.findOne({where:{name:value.name,version:value.version},attributes:['name']})
                if (found) resolve2(true)
                else resolve2(false)
            }).catch(console.log)
            if (await rtn) {
                index.splice(i,1)
                i = i-1
            }
        }
        resolve(index)
    }).then(index => database.ModuleJson.bulkCreate(index)).catch(console.log)
}

function addJson(dir,file,index) {
    if (fs.statSync(`${dir}/${file}`).isFile() && file.includes('.json')) {
        const json = reader.json(`${dir}/${file}`)
        switch (json.type) {
            case undefined: break
            default: break
            case 'Collection': {
                updateCollection(index,json)
            } break
            case 'Scenario': {
                const temp = moduleTemplate(json.name,json.version,json)
                let includesModule = false
                index.forEach(value => {if (!includesModule && value.name == temp.name && value.version == temp.version) includesModule = true})
                if (!includesModule) index.push(temp)
            }
            case 'Submodule' :
            case 'Module': {
                const name = '/'+file == config.jsonFile && json.name || file.substring(0,file.lastIndexOf('_'))
                const temp = moduleTemplate(name,json.version,json)
                let includesModule = false
                index.forEach(value => {if (!includesModule && value.name == temp.name && value.version == temp.version) includesModule = true})
                if (!includesModule) index.push(temp)
            } break
        }
    }
}

function updateDatabase(dir,index) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        const modules = fs.readdirSync(dir)
        if (!modules) console.log('Could not read dir')
        else {
            modules.forEach(module_name => {
                if (fs.statSync(`${dir}/${module_name}`).isDirectory()) {
                    const module_files = fs.readdirSync(`${dir}/${module_name}`)
                    if (!module_files) console.log('Error reading dir')
                    else {
                        module_files.forEach(file => {
                            addJson(`${dir}/${module_name}`,file,index)
                        })
                    }
                } else {
                    addJson(dir,module_name,index)
                }
            })
        }
    }
}

function updateFromScenario(dir,index) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        const modules = fs.readdirSync(dir)
        if (!modules) console.log('Could not read dir')
        else {
            modules.forEach(module_name => {
                if (fs.statSync(`${dir}/${module_name}`).isFile() && module_name.includes('.json') && module_name != 'info.json') {
                    addJson(dir,module_name,index)
                }
            })
        }
    }
}

function addWatch(dir,interville) {
    if (!typeof interville != 'int') interville = 500
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        let files = []
        let index = []
        console.log('Watching dir: '+fs.realpathSync(dir))
        fs.watch(dir,(event,file) => {
            if (event == 'rename' && fs.existsSync(dir+'/'+file) && file.includes('.json')) {
                addJson(dir,file,index)
                files.push(file)
            }
        })
        new Promise(async (resolve,reject) => {
            while (true) {
                await new Promise((resolve,reject) => {setTimeout(resolve,interville)})
                applyUpdates(index)
                files.forEach(file => fs.unlink(`${dir}/${file}`,() => {}))
                files = []; index = []
            }
        }).catch(err => console.log(chalk.red(err)))
    }
}

module.exports = (options) => {
    const dir = process.env.dir
    const port = options.port || config.hostPort
    database.authenticate()
    if (options.dev) app.use_raw()
    const index = []
    if (options.update) {updateDatabase(dir+config.modulesDir,index);updateFromScenario(dir,index)}
    if (options.update && options.useIndex) updateDatabase(dir+config.jsonDir,index)
    if (index.length > 0) applyUpdates(index)
    if (options.watch) addWatch(dir,options.watch)
    app.listen(port, () => {
        console.log('Server started on: '+port)
    })
}*/

const config = require('../config.json')
const fs = require('fs-extra')
const valid = require('../lib/valid')
const reader = require('../lib/reader')
const database = require('../lib/database.js')
const semver = require('semver')

const consoleLog = require('../lib/consoleLog')
const Softmod = require('../lib/Softmod')
const rootDir = process.env.dir

const Express = require('express')
const app = Express()

//app.use('/package',require('../routes/package'))

function convertJson(json) {
    const softmod = Softmod.fromJson(json)
    const version = semver.coerce(softmod.version)
    const keywords = softmod.jsonValue('keywords') || []
    return {
        details: {
            name:softmod.name,
            author: softmod.jsonValue('author'),
            description: softmod.jsonValue('description'),
            license: softmod.jsonValue('license'),
            keywords: keywords.join(';')
        },
        version: {
            name:softmod.versionName,
            json:json,
            versionMajor: version.major,
            versionMinor: version.minor,
            versionPatch: version.patch
        }
    }
}

function addWatch(interval=500) {
    consoleLog('status','Starting watch with interval: '+interval)
    const importsDir = rootDir+'/imports'
    let files = []
    fs.watch(importsDir,(event,file) => {
        if (event == 'rename' && fs.existsSync(`${importsDir}/${file}`)) {
            if (file.endsWith('.json')) {
                // the file is a json file
                fs.readJSON(`${importsDir}/${file}`)
                .catch(err => consoleLog('error',err))
                .then(json => {
                    const converted = convertJson(json)
                    database.ModuleInfo.insertOrUpdate(converted.details).then(created => {
                        if (created) consoleLog('info','Created new softmod entry: '+converted.details.name)
                        database.ModuleVersion.create(converted.version).then(entry => {
                            console.log('test')
                            entry.setSoftmod(converted.details).then(() => {
                                consoleLog('info','Created new version entry: '+converted.version.name)
                            })
                        }).catch(err => consoleLog('error',err))
                    })
                }).catch(err => consoleLog('error',err))
                fs.remove(`${importsDir}/${file}`)
            }
        }
    })
}

module.exports = async cmd => {
    consoleLog('Checking file structure and database')
    process.env.databasePath = rootDir+'/fsm.db'
    fs.ensureDir(rootDir+'/zips')
    fs.ensureDir(rootDir+'/jsons')
    fs.ensureDir(rootDir+'/imports')
    console.log(cmd.port,cmd.address,rootDir)
    if (await database.authenticate()) {
        if (cmd.watch) await addWatch(typeof cmd.watch != 'boolean' ? cmd.watch : undefined)
        consoleLog('status','Starting web server')
        app.listen(cmd.port,cmd.address, () => {
            consoleLog('start','Server started on: '+cmd.port)
        })
        consoleLog('status','Command Finnished')
    }
}