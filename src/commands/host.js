// require
const config = require('./../config.json')
const app = require('./../app')
const fs = require('fs')
const valid = require('./../lib/valid')
const database = require('./../database')

function moduleTemplate(name,version,json,isSubModule) {
    const version_parts = version.split('.')
    return {
        name: name,
        version: version,
        isSubModule: isSubModule,
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
        const json = JSON.parse(fs.readFileSync(`${dir}/${file}`))
        switch (json.module) {
            case 'Collection': {
                if (!valid.collection(json)) break
                updateCollection(index,json)
            } break
            case 'Scenario': {
                if (!valid.secnario(json)) break
                const temp = moduleTemplate(json.name,json.version,json)
                let includesModule = false
                index.forEach(value => {if (!includesModule && value.name == temp.name && value.version == temp.version) includesModule = true})
                if (!includesModule) index.push(temp)
            }
            case undefined: break
            default: {
                if (!valid.module(json)) break
                let isSubModule = false
                if (file.indexOf('.') != file.lastIndexOf('.')) isSubModule = true
                const name = '/'+file == config.jsonFile && json.name || file.substring(0,file.lastIndexOf('@'))
                const temp = moduleTemplate(name,json.version,json,isSubModule)
                let includesModule = false
                index.forEach(value => {if (!includesModule && value.name == temp.name && value.version == temp.version) includesModule = true})
                if (!includesModule) index.push(temp)
            }
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

module.exports = (dir='.',options) => {
    const port = options.port || config.hostPort
    database.authenticate()
    if (options.dev) app.use_raw()
    const index = []
    if (options.update) updateDatabase(dir+config.modulesDir,index)
    if (options.update && fs.existsSync(dir+config.jsonFile)) {addJson(dir,config.jsonFile,index)}
    if (options.update && options.useIndex) updateDatabase(dir+config.jsonDir,index)
    if (index.length > 0) applyUpdates(index)
    app.listen(port, () => {
        console.log('Server started on port: '+port)
    })
}