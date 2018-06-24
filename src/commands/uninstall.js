const fs = require('fs')
const config = require('../config.json')
const reader = require('../lib/reader')
const Chalk = require('chalk')

// removes a dir recusivly and also removes files
function rmdir(dir) {
    return new Promise((resolveMain,rejectMain) => {
        // resolve false if not exists, does not reject as its not an error
        if (!fs.existsSync(dir)) resolveMain(false)
        console.log(Chalk.grey('  Removing file: '+dir))
        if (fs.statSync(dir).isDirectory()) {
            // if it is a dir then it will try to remove it
            fs.rmdir(dir,async err => {
                if (err.code == 'ENOTEMPTY') {
                    // if it is not empty then it will remove all sub files, calling this function
                    await new Promise((resolve,reject) => {
                        fs.readdir(dir,async (err,files) => {
                            if (err) reject(`Error reading dir: ${err}`)
                            else {
                                // loops over files and calls this function then resolves sub promise
                                while (files.length > 0) {
                                    const file = files.pop()
                                    await rmdir(dir+'/'+file)
                                }
                                resolve()
                            }
                        })
                    }).catch(err => console.log(Chalk.red(err)))
                    // now it is empty it will remove the dir
                    fs.rmdir(dir,err => {resolveMain(true)})
                }
            })
        } else {
            // if it is just a file then it will remove the file
            fs.unlink(dir,err => {resolveMain(true)})
        }
    }).catch(err => console.log(Chalk.red(err)))
}

// maybe move these funcations as well as rmdir to a lib file as their are useful, but would need to convert these to not have so much validation (true stuff)
// marks a moddlue to removed unless it is required by a module which needs to
// could maybe make it so it removes a full collection if all modules are removed, will also clean up empty files left by a collection
function getRemoveStatus(dir,mod,mod_name,parent_remove,name,remove) {
    // makes a chain of that will resolve to true or false
    if (parent_remove && typeof remove[mod_name] == 'object' && remove[mod_name].includes(parent_remove)) return
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

// resolves the full tree by going over each value till all are booleans
function resolveRemoveTree(remove) {
    for (let module_name in remove) {
        if (typeof remove[module_name] != 'boolean') {
            remove[module_name] = resolveTreePart(remove,module_name)
        }
    }
}

// removes a file from a dir, file is used to lookup the file to be removed ie foo will remove foobar or barfoo or bar.foo
function removeFileFromDir(dir,file) {
    return new Promise(async (resolve,reject) => {
        if (!fs.existsSync(dir)) resolve(false)
        const files = fs.readdirSync(dir)
        if (!files) reject('Could not read dir: '+dir)
        // loops other the files in the dir
        while (files.length > 0) {
            const next = files.pop()
            // if it matches the file then it is removed, will also remove dirs
            if (next.includes(file)) await rmdir(`${dir}/${next}`)
        }
        fs.rmdir(dir,err => {})
        resolve(true)
    }).catch(err => console.log(Chalk.red(err)))
}

module.exports = async (name='.',dir='.',options) => {
    // if all flag is given it will remove all dirs and files that are made by fsm and restore the default control.lua unless it is empty
    if (options.removeAll) {
        if (dir == '.') dir = name
        console.log(Chalk` {underline Removing Module Dir}`)
        await rmdir(dir+config.modulesDir)
        console.log(Chalk` {underline Removing Json Dir}`)
        await rmdir(dir+config.jsonDir)
        console.log(Chalk` {underline Removing Locale Dir}`)
        await rmdir(dir+config.localeDir)
        console.log(Chalk` {underline Removing Lua Files}`)
        await removeFileFromDir(dir,'.lua')
        await removeFileFromDir(dir,config.jsonFile)
        console.log(Chalk` {underline Restoring Default Factorio Contorl.lua}`)
        const scenario = process.argv[1]+config.srcScenario+config.modulesDir+'/default-factorio-control.lua'
        fs.copyFile(scenario,dir+config.luaFile,err => {if (err) console.log(Chalk.red(err)); else console.log('  Wrote File: '+fs.realpathSync(dir+config.luaFile))})
        return
    }
    // if json flag is given it will remove all the json files
    if (options.clearJsons) {
        if (dir == '.') dir = name
        console.log(Chalk` {underline Removing Json Files}`)
        await rmdir(dir+config.jsonDir)
        return
    }
    // if no name is given then it returns
    if (name == '.') {
        console.log(Chalk.red('Name is required when not clearing json dir'))
        return
    }
    // creates the remove tree and resolves it
    const remove = {}
    await loopOverModules(dir,name,remove)
    resolveRemoveTree(remove)
    // loops over the resolved tree to remove the requested modules
    for (let module_name in remove) {
        if (remove[module_name]) {
            // gets the path of the module
            const path = dir+config.modulesDir+'/'+module_name.replace('.','/')
            if (fs.existsSync(path)) console.log(Chalk` {underline Removing Module: ${module_name}}`)
            // removes all the files within the module
            await rmdir(path)
            // if json remove is set then it will also remove the jsons related to it
            if (options.removeJson) await removeFileFromDir(dir+config.jsonDir,module_name)
            // unless keep locale flag is set then the locale files for the module are removed
            if (!options.keepLocale) {
                const files = fs.readdirSync(dir+config.localeDir)
                if (!files) console.log(Chalk.red('Could not read dir: '+dir+config.localeDir))
                else {
                    while (files.length > 0) {
                        const next = files.pop()
                        if (fs.statSync(dir+config.localeDir+'/'+next).isDirectory()) await removeFileFromDir(dir+config.localeDir+'/'+next,module_name)
                    }
                }
            }
        }
    }
}