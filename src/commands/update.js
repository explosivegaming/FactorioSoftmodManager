// require 
const fs = require('fs')
const valid = require('./../lib/valid')
const config = require('./../config.json')

// will read the json of the module, if one is present, and return the current value
function read_default(dir,key) {
    try {
        const file = dir+config.jsonFile
        const data = JSON.parse(fs.readFileSync(file,'utf8'))
        return data[key] || undefined
    } catch(error) {
        return undefined
    }
}

function addCollectionToScenario(dir,modules,collection_name,collection_version,collection_modules) {
    const submodules = fs.readdirSync(dir)
    let all = true
    for (let module_name in collection_modules) {
        if (!submodules.includes(module_name)) {all = false;break}
    }
    if (all) {
        modules[collection_name] = `^${collection_version}`
    } else {
        submodules.forEach(sub_dir_name => {
            // loops over each submodule
            if (fs.statSync(`${dir}/${sub_dir_name}`).isDirectory()) {
                // does the same thing as if it were a module
                const name = read_default(`${dir}/${sub_dir_name}`,'name')
                const version = read_default(`${dir}/${sub_dir_name}`,'version')
                const module_type = read_default(`${dir}/${sub_dir_name}`,'module')
                if (version && module_type == 'Collection') { 
                    // if it has a version and it is a collection then add the installed submodules not the full collection
                    addCollectionToScenario(`${module_dir}/${dir_name}`,modules,name,version,read_default(`${dir}/${sub_dir_name}`,'submodules'))
                } else if (version) {
                    // if it has a name and version it if added to the json
                    modules[collection_name+'.'+name] = `^${version}`
                }
            }
        })
    }
}

module.exports = async (dir='.',options) => {
    try {
        const data = JSON.parse(fs.readFileSync(dir+config.jsonFile))
        switch (data.module) {
            case 'Scenario': {
                // for scenarios the module dir will be read and auto appented to the json
                data.modules = read_default(dir,'modules') || {}
                const module_dir = dir+config.modulesDir
                const files = fs.readdirSync(module_dir)
                if (!files) {console.log('Skiping module loading, modules dir not found'); break}
                // loops over the files in the module dir
                files.forEach(dir_name => {
                    if (fs.statSync(`${module_dir}/${dir_name}`).isDirectory()) {
                        // if it is a dir then it will try to read the json file and retreive a name
                        const name = read_default(`${module_dir}/${dir_name}`,'name')
                        if (name) {
                            const version = read_default(`${module_dir}/${dir_name}`,'version')
                            const module_type = read_default(`${module_dir}/${dir_name}`,'module')
                            if (version && module_type == 'Collection') { 
                                // if it has a version and it is a collection then add the installed submodules not the full collection
                                addCollectionToScenario(`${module_dir}/${dir_name}`,data.modules,name,version,read_default(`${module_dir}/${dir_name}`,'submodules'))
                            } else if (version) {
                                // if it has a name and version it if added to the json
                                data.modules[name] = `^${version}`
                            }
                        }
                    }
                })
            } break
            case 'Collection': {
                // if it is a collection it will get extra info and look in the current dir for modules
                data.submodules = read_default(dir,'submodules') || {}
                const files = fs.readdirSync(dir)
                if (!files) {console.log('Skiping module loading, modules dir not found'); break}
                // loops over files in the current dir
                files.forEach(dir_name => {
                    if (fs.statSync(`${dir}/${dir_name}`).isDirectory()) {
                        // if it is a dir then it will try to read the json file and retreive a name
                        const name = read_default(`${dir}/${dir_name}`,'name')
                        if (name) {
                            // if it is a valid submodule it is added to the json
                            const module_data = JSON.parse(fs.readFileSync(`${dir}/${dir_name}${config.jsonFile}`))
                            if (valid.submodule(module_data)) data.submodules[name] = module_data
                        }
                    }
                })
                // will loop over already existing submodules to cheak that all are valid
                if (config.cleanModules) for (let submodule_name in data.submodules) if (!valid.submodule(data.submodules[submodule_name])) delete data.submodules[submodule_name]
            } break
            default: {}
        }
        // the json file is then writen into the dir
        fs.writeFile(dir+config.jsonFile,JSON.stringify(data,undefined,4),err => {
            if (err) console.log(`Error writing file: ${err}`) 
            else console.log(`Wrote file: ${fs.realpathSync(dir+config.jsonFile)}`)
        })
    } catch(error) {
        // logs all errors but ^C
        if (error.message != 'canceled') console.log(error)
    }
}