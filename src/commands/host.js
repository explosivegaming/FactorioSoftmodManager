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
    index.push(moduleTemplate(collection.name,collection.version,collection))
    for (let module_name in collection.submodules) {
        const submodule = collection.submodules[module_name]
        if (valid.submodule(submodule)) {
            index.push(moduleTemplate(collection.name+'.'+submodule.name,submodule.version,submodule,true))
        }
    }
}

function updateDatabase(dir) {
    if (fs.existsSync(dir+config.modulesDir) && fs.statSync(dir+config.modulesDir).isDirectory()) {
        fs.readdir(dir+config.modulesDir,(err,modules) => {
            if (err) console.log('Could not read dir: '+err)
            else {
                const index = []
                modules.forEach(module => {
                    if (fs.statSync(`${dir+config.modulesDir}/${module}`).isDirectory()) {
                        const file = fs.readFileSync(`${dir+config.modulesDir}/${module}${config.jsonFile}`)
                        if (!file) console.log('Could not read file')
                        else {
                            const json = JSON.parse(file)
                            switch (json.module) {
                                case 'Collection': {
                                    if (!valid.collection(json)) break
                                    updateCollection(index,json)
                                } break
                                case 'Scenario': break
                                case undefined: break
                                default: {
                                    if (!valid.module(json)) break
                                    index.push(moduleTemplate(json.name,json.version,json))
                                }
                            }
                        }
                    }
                })
                index.map(async value => {
                    const found = await database.ModuleJson.findOne({where:{name:value.name,version:value.version}})
                    if (!found) return value
                })
                database.ModuleJson.bulkCreate(index)
            }
        })
    }
}

module.exports = (dir='.',options) => {
    const port = options.port || config.hostPort
    database.authenticate()
    if (options.dev) app.use_raw()
    if (options.update) updateDatabase(dir)
    app.listen(port, () => {
        console.log('Server started on port: '+port)
    })
}