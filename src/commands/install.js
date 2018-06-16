// require
const fs = require('fs')
const Chalk = require('chalk')
const promptly = require('promptly')
const config = require('./../config.json')
const valid = require('./../lib/valid')
const Request = require('request')
const request = Request.defaults({baseUrl:config.serverURL})

// copies scenario dir to the install dir
async function init_dir(dir,force) {
    const scenario = process.argv[1]+config.srcScenario
    const files = fs.readdirSync(scenario)
    if (!files) throw new Error('Unable to find scenario template')
    // loop over files in scenario dir
    files.forEach(file_name => {
        if (!fs.existsSync(`${dir}/${file_name}`) || force) {
            // if it does not exist or if force flag is set
            if (fs.statSync(`${scenario}/${file_name}`).isDirectory()) {
                // if it is a dir
                if (fs.existsSync(`${dir}/${file_name}`)) {
                    // if the dir is already present in the dest dir
                    if (force) {
                        console.log('to do once downloading works, clear dir and remake')
                        /*fs.rmdirSync(`${dir}/${file_name}`)
                        fs.mkdir(`${dir}/${file_name}`,err => {
                            if (err) console.log(`Error creating dir ${fs.realpathSync(dir)}/${file_name}: ${err}`) 
                            else console.log(`Created new dir: ${fs.realpathSync(dir+'/'+file_name)}`)
                        })*/
                    }
                } else {
                    // if the dir is not present in the dest dir then it is made
                    fs.mkdir(`${dir}/${file_name}`,err => {
                        if (err) console.log(Chalk`{red Error creating dir ${fs.realpathSync(dir)}/${file_name}: ${err}}`) 
                        else console.log(`  Created new dir: ${fs.realpathSync(dir+'/'+file_name)}`)
                    })
                }
            } else {
                // if it is a file then it is copyed, must not already exist
                fs.copyFile(`${scenario}/${file_name}`,`${dir}/${file_name}`,err => {
                    if (err) console.log(Chalk`{red Error writing file ${fs.realpathSync(dir)}/${file_name}: ${err}}`) 
                    else console.log(`  Wrote file: ${fs.realpathSync(dir+'/'+file_name)}`)
                })
            }
        }
    })
}

// copies and then deletes the locale files of a module, can be a folders or files nammed by the locale eg en or fr
function copy_locale(src,dest) {
    console.log(`  Coping locale files from: ${src}`)
    // src must have been cheaked as vaild already
    fs.readdir(src,(err,files) => {
        if (err) console.log(Chalk`{red Could not read locale dir: ${err}}`)
        else {
            // loops over files in the locale
            files.forEach(file => {
                if (fs.statSync(`${src}/${file}`).isDirectory()) {
                    // if it is a dir, creates a new dir in locale if it is not already present
                    if (!fs.existsSync(`${dest}/${file}`)) {console.log(`   Created new locale dir: ${file}`); fs.mkdirSync(`${dest}/${file}`)}
                    // reads this sub locale dir to get the cfg files
                    fs.readdir(`${src}/${file}`,(err,locale_files) => {
                        if (err) console.log(Chalk`{red Could not read locale dir: ${err}}`)
                        else {
                            // loops over cfg files in sub locale dir
                            locale_files.forEach(lcoale_file => {
                                // only copies files, will not look in sub dirs of the sub locale dir
                                if (!fs.statSync(`${src}/${file}/${lcoale_file}`).isDirectory()) {
                                    // generates a file name for the locale cfg file, the module name/location
                                    let file_name = src.indexOf(config.modulesDir) > 0 && src.substring(src.indexOf(config.modulesDir)+9) || src.indexOf(`\\${config.modulesDir.substring(1)}`) > 0 && src.substring(src.indexOf(`\\${config.modulesDir.substring(1)}`)+9)
                                    file_name = file.substring(0,file.lastIndexOf('.'))+'/'+file_name.replace(/\//g, '.').substring(0,file_name.length-7)
                                    // copies the file under this new name
                                    fs.copyFile(`${src}/${file}/${lcoale_file}`,`${dest}/${file}/${file_name}.cfg`,err => {
                                        if (err) console.log(Chalk`{red Failed to copy locale file ${err}}`)
                                        else {
                                            // will keep attempting to remove the dir once the file is copied and removed
                                            console.log(`   Copyed locale file: ${file_name}.cfg`)
                                            if (config.removeLocaleAfterInstall) {
                                                fs.unlink(`${src}/${file}/${lcoale_file}`,err => {if (err) console.log(Chalk`{red Failed to remove locale file: ${err}}`)})
                                                fs.rmdir(`${src}/${file}`,err => {})
                                                fs.rmdir(src,err => {})
                                            }
                                        }
                                    })
                                }
                            })
                        }
                    })
                } else {
                    // if it is a file, will create a a new dir of the name of the cfg file in locale if not already made
                    if (!fs.existsSync(`${dest}/${file.substring(0,file.lastIndexOf('.'))}`)) {console.log(`   Created new locale dir: ${file.substring(0,file.lastIndexOf('.'))}`); fs.mkdirSync(`${dest}/${file.substring(0,file.lastIndexOf('.'))}`)}
                    // generates a file name for the locale cfg file, the module name/location
                    let file_name = src.indexOf(config.modulesDir) > 0 && src.substring(src.indexOf(config.modulesDir)+9) || src.indexOf(`\\${config.modulesDir.substring(1)}`) > 0 && src.substring(src.indexOf(`\\${config.modulesDir.substring(1)}`)+9)
                    file_name = file.substring(0,file.lastIndexOf('.'))+'/'+file_name.replace(/\//g, '.').substring(0,file_name.length-7)
                    // copies the file under this new name
                    fs.copyFile(`${src}/${file}`,`${dest}/${file_name}${config.localeExt}`,err => {
                        if (err) console.log(`Failed to copy locale file ${err}`)
                        else {
                            // will keep attempting to remove the dir once the file is copied and removed
                            console.log(`   Copied locale file: ${file_name}${config.localeExt}`)
                            if (config.removeLocaleAfterInstall) {
                                fs.unlink(`${src}/${file}`,err => {if (err) console.log('Failed to remove locale file: '+err)})
                                fs.rmdir(src,err => {})
                            }
                        }
                    })
                }
            })
        } if (files.length === 0 && config.removeLocaleAfterInstall) fs.rmdir(src,err => {}) // if the locale dir were already emtpy then they are removed
    })
}

// a recersive lookup for any locale files for modules, will not look in sub dir of the locale dir
function find_locale(src,dest) {
    console.log(Chalk`  {grey Searching for locale dir in: ${src}}`)
    // src must have been cheaked as vaild already
    fs.readdir(src,(err,files) => {
        if (err) console.log(Chalk`{red Could not read dir: ${err}}`)
        else {
            // loops over all files in the dir
            files.forEach(file => {
                if (fs.statSync(`${src}/${file}`).isDirectory()) {
                    // if it is a dir then it will cheak the name, else look at the sub dirs
                    if (file === config.localeDir.substring(1)) copy_locale(`${src}/${file}`,dest)
                    else find_locale(`${src}/${file}`,dest)
                }
            })
        }
    })
}

// adds a module or submodules from a collection into the lua index
function append_index(index,path,modules) {
    // loops over the modules, data objects
    for (let name in modules) {
        const mod = modules[name]
        switch (mod.module) {
            case 'Collection': {
                // if it is a collection it will repeat but for the submodules of the collection
                append_index(index,`${path}/${name}`,mod.submodules)
            } break
            default: {
                // if it is a module then its name and path are added to the index
                console.log(`  Adding ${name} to lua index`)
                if (fs.existsSync(`${path}/${name}`) && fs.existsSync(`${path}/${name}${config.luaFile}`)) {
                    if (mod.module === config.indexPriority) index[mod.module+'-'+mod.name] = `${path}/${name}`
                    else index[mod.module] = `${path}/${name}`
                }
            } break
        }
    }
}

// creates the lua index file after searching modules dir
function create_index(dir) {
    const index = {}
    const module_path = dir+config.modulesDir
    const index_path = module_path+config.modulesIndex
    // reads the modules dir
    fs.readdir(module_path,(err,files) => {
        if (err) console.log(Chalk`{red Could not open module dir: ${err}`)
        else {
            // loops over files in the module dir
            files.forEach(file => {
                if (fs.statSync(`${module_path}/${file}`).isDirectory()) {
                    // if it is a dir then it will try to read the json file
                    const mod = fs.readFileSync(`${module_path}/${file}${config.jsonFile}`)
                    if (!mod) console.log(Chalk`{red Could not read module: ${file}}`)
                    else {
                        // if successful it will parse the json and call append_index
                        const data = JSON.parse(mod)
                        if (data.submodules) append_index(index,`${module_path}/${data.name}`,data.submodules)
                        else {
                            const modules = {}
                            modules[data.name]=data
                            append_index(index,module_path,modules)
                        }
                    }
                }
            })
            // once all modules are added it will create the lua file
            let write_str = ''
            // first loops over each index and creates a string of the index object in a lua friendly way
            for (let module_name in index) {
                const module_path = index[module_name]
                // if it has GlobalLib in its name then it is put at the front of the index
                if (module_name.includes(config.indexPriority)) write_str=(config.indexBody.replace('${module_name}',module_name).replace('${module_path}',module_path))+write_str
                else write_str=write_str+(config.indexBody.replace('${module_name}',module_name).replace('${module_path}',module_path))
            }
            // once it has formed the string it will add the header and footer to the file and create the file
            fs.writeFile(index_path,config.indexHeader+write_str+config.indexFooter,err => {
                if (err) console.log(Chalk`{red Error writing file: ${err}}`)
                else console.log(`  Wrote file: ${fs.realpathSync(index_path)}`)
            })
        }
    }) 
}

async function getJsons(dir,index,queue,opt_modules,failed_modules) {
    const next = queue.pop()
    const name = next[0]
    const version = next[1]
    if (failed_modules[name] && failed_modules[name].includes(version)) return
    if (index[name] && index[name].includes(version.match(/(\d+\.\d+\.\d+)/)[1])) return
    console.log(`  Getting Json for ${name}@${version}...`)
    return new Promise((resolve,reject) => {
        request.get(`/package/${name}?version=${version}`,{json:true},(error, response, body) => {
            if (error || (typeof body == 'string' && body.includes('Error'))) {
                const err = typeof body == 'string' && body || error
                if (failed_modules[name]) failed_modules[name].push(version)
                else failed_modules[name] = [version]
                reject(err);return
            }
            const json = body.json
            const latest = body.lastest
            const alearatives = body.alterantives
            let isValid = false
            switch (json.module) {
                case undefined: break
                default: {
                    if (body.isSubModule && valid.submodule(json)) {index[name] = [latest,alearatives]; isValid=true}
                    else if (valid.module(json)) {index[json.name] = [latest,alearatives]; isValid=true}
                    if (isValid) {
                        for (let module_name in json.dependencies) {
                            if (index[module_name]) index[module_name].map(possible_version => alearatives.includes(possible_version) && possible_version || undefined)
                            else {console.log(Chalk`   {grey Adding dependency to queue: ${module_name}@${json.dependencies[module_name]}}`); queue.push([module_name,json.dependencies[module_name]])}
                            if (json.dependencies[module_name].includes('?') && opt_modules[module_name] != false) if(opt_modules[module_name]) {opt_modules[module_name].push(name)} else {opt_modules[module_name] = [name]}
                            else if(opt_modules[module_name]) opt_modules[module_name] = false
                        }
                    }
                } break
                case 'Scenario': {
                    if (valid.secnario(json)) {
                        isValid=true
                        for (let module_name in json.modules) {
                            if (index[module_name]) index[module_name].map(possible_version => alearatives.includes(possible_version) && possible_version || undefined)
                            else {console.log(Chalk`   {grey Adding module to queue: ${module_name}@${json.modules[module_name]}}`); queue.push([module_name,json.modules[module_name]])}
                        }
                    }
                } break
                case 'Collection': {
                    if (valid.collection(json)) {
                        isValid=true
                        for (let module_name in json.submodules) {
                            if (index[name+'.'+module_name]) index[name+'.'+module_name].map(possible_version => alearatives.includes(possible_version) && possible_version || undefined)
                            else {console.log(Chalk`   {grey Adding submodule to queue: ${module_name}@${json.submodules[module_name].version}}`); queue.push([json.name+'.'+module_name,json.submodules[module_name].version])}
                        }
                    }
                } break
            }
            if (isValid) {
                if (!fs.existsSync(`${dir}/tempJsonDir` || !fs.statSync(`${dir}/tempJsonDir`).isDirectory())) fs.mkdirSync(`${dir}/tempJsonDir`)
                fs.writeFile(`${dir}${config.jsonDir}/${name}@${latest}.json`,JSON.stringify(json,undefined,4),() => {})
            } else console.log(Chalk`{red File was invalid}`)
            resolve()
        })
    }).catch(err => console.log(Chalk.red(err)))
}

function read_download_json(dir,name,version,queue,get) {
    return new Promise((resolve,reject) => {
        if (get) {
            request.get(`/package/${name}?version=${version}`,{json:true},(error, response, body) => {
                if (error || (typeof body == 'string' && body.includes('Error'))) {
                    const err = typeof body == 'string' && body || error
                    reject(err);return
                }
                queue.push(body.json.location)
                console.log(Chalk`  Added ${module_name}@${version}: {grey ${json.location}}`)
                resolve()
            })
        } else {
            fs.readFile(`${dir}${config.jsonDir}/${name}@${version}.json`,(err,file) => {
                if (err) reject(err)
                else {
                    const json = JSON.parse(file)
                    queue.push(json.location)
                    console.log(Chalk`  Added ${name}@${version}: {grey ${json.location}}`)
                    resolve()
                }
            })
        }
    }).catch(err => console.log(Chalk.red(err)))
}

async function create_download_queue(dir,queue,index,opt_modules,yes_all) {
    for (let module_name in index) {
        const versions = index[module_name][1]
        let version = index[module_name][0]
        let install = true
        if (opt_modules[module_name] && !yes_all) {
            console.log(`  ${module_name}@${version} has been requested by ${opt_modules[module_name].length} other modules as an optinal dependiency.`)
            install = await promptly.confirm(Chalk`   Would you like to install this module: (yes)`,{default:'yes'})
        }
        if (install && versions.includes(version)) {
            await read_download_json(dir,module_name,version,queue)
        } else if (install) {
            const lastest = [0,0,0]
            versions.forEach(v => {
                const version_parts = v.split('.')
                if (version_parts[0] > lastest[0] ||
                    version_parts[0] == lastest[0] && version_parts[1] > lastest[1] ||
                    version_parts[0] == lastest[0] && version_parts[1] == lastest[1] && version_parts[3] > lastest[2]) {
                        lastest[0]=result.versionMajor
                        lastest[1]=result.versionMinor
                        lastest[2]=result.versionPatch
                }
            })
            version = lastest.join('.')
            await read_download_json(dir,module_name,version,queue,true)
        }
    }
}

module.exports = async (name='.',dir='.',options) => {
    if (options.dryRun) {
        // will not download anything
        console.log(Chalk` {underline Initiating Scenario Dir}`)
        await init_dir(dir,options.force)
        console.log(Chalk` {underline Coping Locale Dirs}`)
        find_locale(dir+config.modulesDir,dir+config.localeDir)
        console.log(Chalk` {underline Creating Lua Index}`)
        create_index(dir)
    } else {
        const index_queue = []
        const download_queue = []
        const index = {}
        const failed_modules = {}
        const opt_modules = {}
        // adds the requested modules and version to the queue
        if (options.moduleVersion) index_queue.push([name,options.moduleVersion])
        else if (name.lastIndexOf('@') > 0) index_queue.push([name.substring(0,name.lastIndexOf('@')),name.substring(name.lastIndexOf('@')+1)])
        else index_queue.push([name,'*'])
        // if no module is given then it will look in the current dir to find a module json
        if (name == '.') {
            if (fs.existsSync(name+config.jsonFile) && fs.statSync(name+config.jsonFile).isFile()) {
                const json = JSON.parse(fs.readFileSync(name+config.jsonFile))
                if (json.module == 'Scenario') {
                    index_queue.pop()
                    for (let module_name in json.modules) index_queue.push([module_name,json.modules[module_name]])
                }
            }
        }
        // starts install
        console.log(Chalk` {underline Initiating Scenario Dir}`)
        await init_dir(dir)
        console.log(Chalk` {underline Finding Module Versions}`)
        while (index_queue.length > 0) await getJsons(dir,index,index_queue,opt_modules,failed_modules)
        console.log(Chalk` {underline Selecting Version Download}`)
        await create_download_queue(dir,download_queue,index,opt_modules,options.yesAll)
        // download modules
        console.log(Chalk` {underline Crating Locale Files And Lua Index}`)
        find_locale(dir+config.modulesDir,dir+config.localeDir)
        create_index(dir)
    }
}