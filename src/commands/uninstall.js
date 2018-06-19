const fs = require('fs')
const valid = require('../lib/valid')
const config = require('../config.json')
const reader = require('../lib/reader')
const Chalk = require('chalk')

// need to get this to work, for some reason it ios not waiting on the loop
function rmdir(dir) {
    if (!fs.existsSync(dir)) return
    console.log(Chalk.grey('Removing file: '+dir))
    return new Promise((resolveMain,rejectMain) => {
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
            fs.rmdir(dir,async err => {
                if (err.code == 'ENOTEMPTY') {
                    await new Promise((resolve,reject) => {
                        fs.readdir(dir,async (err,files) => {
                            if (err) reject(`Error reading dir: ${err}`)
                            else {
                                while (files.length > 0) {
                                    const file = files.pop()
                                    await rmdir(dir+'/'+file)
                                }
                                resolve()
                            }
                        })
                    }).catch(err => console.log(Chalk.red(err)))
                    fs.rmdir(dir,err => {})
                }
            })
        } else {
            fs.unlink(dir,err => {})
        }
        resolveMain()
    }).catch(err => console.log(Chalk.red(err)))
}

// maybe move these funcations as well as rmdir to a lib file as their are useful, but would need to convert these to not have so much validation (true stuff)
// marks a moddlue to removed unless it is required by a module which needs ot
function getRemoveStatus(dir,mod,mod_name,parent_remove,name,remove) {
    // makes a chain of that will resolve to true or false
    if (parent_remove && remove[mod_name] && remove[mod_name].includes(parent_remove)) return
    if (remove[mod_name] != true && remove[mod_name]) remove[mod_name].push(parent_remove)
    else if (remove[mod_name] != true) remove[mod_name] = (mod_name == name) || [parent_remove]
    // handles the dependies running this function again
    switch (mod.type) {
        default: break
        case undefined: break
        case 'Scenario': {
            throw new Error('A Scenario type should not be within another module')
        } break
        case 'Collection': {
            for (let sub_module in mod.submodules) {
                const data = mod.submodules[sub_module]
                getRemoveStatus(dir,data,mod_name+'.'+data.name,mod_name,name,remove)
            }
        } break
        case 'Submodule':
        case 'Module': {
            for (let dependency in mod.dependencies) {
                const data = reader.json(dir+config.modulesDir+'/'+dependency.replace('.','/'))
                if (data) {
                    getRemoveStatus(dir,data,dependency,mod_name,name,remove)
                }
            }
        } break
    }
}

// loops over the root of the modules before then calling the remove function
function loopOverModules(dir,name,remove) {
    const module_path = dir+config.modulesDir
    // reads the modules dir
    return new Promise((resolve,reject) => {
        fs.readdir(module_path,(err,files) => {
            if (err) reject(`Could not open module dir: ${err}`)
            else {
                // loops over files in the module dir
                files.forEach(file => {
                    if (fs.statSync(`${module_path}/${file}`).isDirectory()) {
                        // if it is a dir then it will try to read the json file
                        const mod = reader.json(`${module_path}/${file}`)
                        if (!mod) throw new Error('Could not read json for: '+`${module_path}/${file}`)
                        if (mod.type == 'Scenario') {
                            mod.modules.forEach(scen_module => {
                                if (remove[scen_module] != false) remove[scen_module] = true
                            })
                        } else getRemoveStatus(dir,mod,mod.name,undefined,name,remove)
                    }
                })
            }
            resolve()
        })
    }).catch(err => console.log(Chalk.red(err)))
}

// takes one part and resolves it
function resolveTreePart(remove,name,stack=[]) {
    // gets a list or a boolean
    const new_part = remove[name]
    // if it is already resolved then it is returned
    if (typeof new_part == 'boolean') return new_part
    else if (!new_part) return undefined
    else {
        // else it loops of each dependicy and resolves it, only return true if no false values were found
        let rtn = false
        new_part.forEach(part => {
            if (part && !stack.includes(name)) {
                stack.push(name)
                remove[part] = resolveTreePart(remove,part,stack)
                if (!rtn && remove[part]) rtn = remove[part]
            }
        })
        return rtn
    }
}

function resolveRemoveTree(remove) {
    for (let module_name in remove) {
        if (typeof remove[module_name] != 'boolean') {
            remove[module_name] = resolveTreePart(remove,module_name)
        }
    }
}

module.exports = async (name='.',dir='.',options) => {
    if (options.clearJsons) {
        if (dir == '.') dir = name
        rmdir(dir+config.jsonDir)
        return
    }
    if (name == '.') {
        console.log(Chalk.red('Name is required when not clearing json dir'))
        return
    }
    const remove = {}
    await loopOverModules(dir,name,remove)
    resolveRemoveTree(remove)
    for (let module_name in remove) {
        const path = dir+config.modulesDir+'/'+module_name.replace('.','/')
        if (remove[module_name]) {
            console.log(path)
            await rmdir(path)
            if (options.removeJson) {
                fs.readdir(dir+config.jsonDir,(err,files) => {
                    if (err) console.log(Chalk.red(err))
                    else {
                        files.forEach(file => {
                            if (file.includes(module_name)) rmdir(dir+config.jsonDir+'/'+module_name)
                        })
                    }
                })
            }
            if (!options.keepLocale) {
                fs.readdir(dir+config.localeDir,(err,sub_dirs) => {
                    if (err) console.log(Chalk.red(err))
                    else {
                        sub_dirs.forEach(sub_dir => {
                            fs.readdir(dir+config.localeDir+'/'+sub_dir,(err,files) => {
                                if (err) console.log(Chalk.red(err))
                                else {
                                    files.forEach(file => {
                                        if (file.includes(module_name)) rmdir(dir+config.localeDir+'/'+sub_dir+'/'+module_name)
                                    })
                                }
                            })
                        })
                    }
                })
            }
        }
    }
}