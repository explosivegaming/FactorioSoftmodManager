// require
const fs = require('fs')
const Chalk = require('chalk')
const promptly = require('promptly')
const config = require('../config.json')
const Version = require('../lib/version')
const Downloader = require('../lib/downloader')
const Tree = require('../lib/tree')

function rmdir(dir) {
    if (fs.statSync(dir).isDirectory()) {
        fs.readdir(dir,(err,files) => {
            if (err) console.log(Chalk`{red Error reading dir: ${err}}`)
            else if (files.length == 0) fs.rmdir(dir,err => {})
            else files.forEach(file => rmdir(dir+'/'+file))
        })
    } else {
        fs.unlink(dir,err => fs.rmdir(dir+'/../',err => {}))
    }
}

// copies scenario dir to the install dir
async function init_dir(dir,force) {
    const scenario = process.argv[1]+config.srcScenario
    const files = fs.readdirSync(scenario)
    if (!files) throw new Error('Unable to find scenario template')
    // loop over files in scenario dir
    return new Promise((resolve,reject) => {
        files.forEach(file_name => {
            if (!fs.existsSync(`${dir}/${file_name}`) || force) {
                // if it does not exist or if force flag is set
                if (fs.statSync(`${scenario}/${file_name}`).isDirectory()) {
                    // if it is a dir
                    if (!fs.existsSync(`${dir}/${file_name}`)) {
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
        resolve()
    }).catch(err => console.log(Chalk.red(err)))
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
function append_index(index,path,modules,collection) {
    const index_path = path.substring(path.indexOf(config.modulesDir))
    // loops over the modules, data objects
    for (let name in modules) {
        const mod = modules[name]
        if (collection) name = collection+'.'+name
        switch (mod.type) {
            case undefined: break
            default: break
            case 'Collection': {
                // if it is a collection it will repeat but for the submodules of the collection
                append_index(index,`${path}/${mod.name}`,mod.submodules,mod.name)
            } break
            case 'Submodule':
            case 'Module': {
                // if it is a module then its name and path are added to the index
                console.log(`  Adding ${name} to lua index`)
                if (fs.existsSync(`${path}/${mod.name}`) && fs.existsSync(`${path}/${mod.name}${config.luaFile}`)) {
                    index[name] = `${index_path}/${mod.name}`
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
    return new Promise((resolve,reject) => {
        fs.readdir(module_path,(err,files) => {
            if (err) reject(`Could not open module dir: ${err}`)
            else {
                // loops over files in the module dir
                files.forEach(file => {
                    if (fs.statSync(`${module_path}/${file}`).isDirectory()) {
                        // if it is a dir then it will try to read the json file
                        const mod = fs.readFileSync(`${module_path}/${file}${config.jsonFile}`)
                        if (!mod) reject(`Could not read module: ${file}`)
                        else {
                            // if successful it will parse the json and call append_index
                            const data = JSON.parse(mod)
                            if (data.submodules) append_index(index,`${module_path}/${data.name}`,data.submodules,data.name)
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
                    if (err) reject(`Error writing file: ${err}`)
                    else console.log(`  Wrote file: ${fs.realpathSync(index_path)}`)
                    resolve()
                })
            }
        })
    }).catch(err => console.log(Chalk.red(err)))
}

// gets the next json file from the queue, used to find latest versions for modules
async function getJsons(dir,index,queue,opt_modules,failed_modules,installed_modules,use_force) {
    const next = queue.pop()
    const name = next[0]
    const version = next[1]
    // if the module is already installed then it will skip the module and add it to the installed list
    if (installed_modules[name] || fs.existsSync(`${dir+config.modulesDir}/${name.replace('.','/')}`)) {
        if (use_force) rmdir(`${dir+config.modulesDir}/${name.replace('.','/')}`)
        else {installed_modules.push(name);return}
    }
    // if this lookup as failed previously it will not try again, or if the requested version is already found
    if (failed_modules[name] && failed_modules[name].includes(version)) return
    if (index[name] && index[name].includes(version.match(/(\d+\.\d+\.\d+)/)[1])) return
    // gets the json file for the version lookup
    console.log(`  Getting Json for ${name}@${version}...`)
    const rawDownload = await Downloader.getJson(dir,name,version)
    if (!rawDownload) {
        if (failed_modules[name]) failed_modules[name].push(version)
        else failed_modules[name] = [version]
    }
    const json = rawDownload.json
    const alterantives = rawDownload.alterantives
    // adds avibile versions to a lookup index
    index[name] = [rawDownload.latest,alterantives]
    // depending on what type of module it is then it will require different validation
    switch (json.type) {
        case 'Submodule': {
            const collection_name = name.substring(0,name.lastIndexOf('.'))
            if (!index[collection_name]) {
                console.log(Chalk`   {grey Adding collection to queue: ${collection_name}}`)
                queue.push([collection_name,'^'+json.version])
                opt_modules[collection_name] = true
            }
        }
        case 'Module': {
            // dependencies are added to the lookup queue
            for (let module_name in json.dependencies) {
                // if it is already found then it will filter the veresions that can be used
                if (index[module_name]) index[module_name].filter(possible_version => alterantives.includes(possible_version))
                // other wise it will add the dependency to the lookup queue
                else {console.log(Chalk`   {grey Adding dependency to queue: ${module_name}@${json.dependencies[module_name]}}`); queue.push([module_name,json.dependencies[module_name]])}
                // if the dependency is optional this module is added to the list that request the module (if it is not required bu another)
                if (json.dependencies[module_name].includes('?') && typeof opt_modules[module_name] != 'boolean') if(opt_modules[module_name]) {opt_modules[module_name].push(name)} else {opt_modules[module_name] = [name]}
                // if this dependency is required then it will be marked as such
                else if(opt_modules[module_name] && opt_modules[module_name] != true) opt_modules[module_name] = false
            }
        } break
        case 'Scenario': {
            // if a secnario is requrested then all the modules for that scenario are requested
            for (let module_name in json.modules) {
                // if it is already found then it will filter the veresions that can be used
                if (index[module_name]) index[module_name].filter(possible_version => alterantives.includes(possible_version))
                // other wise it will add the dependency to the lookup queue
                else {console.log(Chalk`   {grey Adding module to queue: ${module_name}@${json.modules[module_name]}}`); queue.push([module_name,json.modules[module_name]])}
            }
        } break
        case 'Collection': {
            if (opt_modules[name] == true) break
            // if a collection was requested then all its submodules will also be requested
            for (let module_name in json.submodules) {
                // if it is already found then it will filter the veresions that can be used
                if (index[name+'.'+module_name]) index[name+'.'+module_name].filter(possible_version => alterantives.includes(possible_version))
                // other wise it will add the dependency to the lookup queue
                // also sets the opt module index to true as this shows that it will be installed as a full collection
                else {console.log(Chalk`   {grey Adding submodule to queue: ${module_name}@${json.submodules[module_name].version}}`);queue.push([json.name+'.'+module_name,json.submodules[module_name].version]);opt_modules[json.name+'.'+module_name]=true}
            }
        } break
    }
}

// creates the download queue to be used by the downloader
async function create_download_queue(dir,queue,index,opt_modules,yes_all) {
    // loops or the index which was created by the json lookups
    for (let module_name in index) {
        const versions = index[module_name][1]
        let version = index[module_name][0]
        if (opt_modules[module_name] != true) {
            // if the module is optional then the user is asked if it should be installed, unless -y is given
            if (opt_modules[module_name] && !yes_all) {
                console.log(`  ${module_name}@${version} has been requested by ${opt_modules[module_name].length} other modules as an optinal dependiency.`)
                if (!await promptly.confirm(Chalk`   Would you like to install this module: (yes)`,{default:'yes'})) return
            }
            // if there are no vaild version then it thows an error
            if (versions.length == 0) throw new Error(`There was a version confilct for ${module_name} no valid versions were found to match all requirements`)
            // if the latest is convlicking with the allowed version then the latest from that list is used
            // uses the new latest version to get the download location
            if (!versions.includes(version)) version = Version.max(versions)
            // either gets the json for a version or reads the chached one to get the download location
            await new Promise(async (resolve,reject) => {
                const json = await Downloader.getJson(dir,name,version)
                // adds the module to the download queue and saves this version of the json
                queue.push([name,json.version])
                console.log(Chalk`  Added ${name}@${json.version}: {grey ${json.location}}`)
                resolve()
            }).catch(err => console.log(Chalk.red(err)))
        }
    }
}

module.exports = async (name='.',dir='.',options) => {
    try {
        if (options.dryRun) {
            // will not download anything
            console.log(Chalk` {underline Initiating Scenario Dir}`)
            await init_dir(dir,options.force)
            console.log(Chalk` {underline Creating Lua Index}`)
            await create_index(dir)
            console.log(Chalk` {underline Copying Locale Files}`)
            find_locale(dir+config.modulesDir,dir+config.localeDir)
        } else {
            const index_queue = []
            const download_queue = []
            const index = {}
            const failed_modules = {}
            const installed_modules = []
            const opt_modules = {}
            // adds the requested modules and version to the queue
            if (options.moduleVersion) index_queue.push([name,options.moduleVersion])
            else if (name.lastIndexOf('@') > 0) index_queue.push([name.substring(0,name.lastIndexOf('@')),name.substring(name.lastIndexOf('@')+1)])
            else index_queue.push([name,'*'])
            // if no module is given then it will look in the current dir to find a module json
            if (name == '.') {
                if (fs.existsSync(name+config.jsonFile) && fs.statSync(name+config.jsonFile).isFile()) {
                    const json = JSON.parse(fs.readFileSync(name+config.jsonFile))
                    if (json.type == 'Scenario') {
                        index_queue.pop()
                        for (let module_name in json.modules) index_queue.push([module_name,json.modules[module_name]])
                    }
                }
            }
            // starts install
            console.log(Chalk` {underline Initiating Scenario Dir}`)
            await init_dir(dir)
            console.log(Chalk` {underline Finding Module Versions}`)
            while (index_queue.length > 0) await getJsons(dir,index,index_queue,opt_modules,failed_modules,installed_modules,options.force)
            // warning message if there were modules already installed that were requested
            if (installed_modules.length > 0) {
                console.log('  The following modules were skiped due to them already being installed: ')
                console.log('   '+installed_modules.join(', '))
                console.log('  Please use -f to force a reinstall of all modules')
            }
            // creates a download queue and then downloads the modules
            console.log(Chalk` {underline Selecting Version Download}`)
            await create_download_queue(dir,download_queue,index,opt_modules,options.yesAll)
            console.log(Chalk` {underline Downloading Modules}`)
            while (download_queue.length > 0) {
                const next = download_queue.pop()
                await Downloader.getModule(dir,next[0],next[1])
            }
            console.log(Chalk` {underline Creating Lua Index}`)
            await create_index(dir)
            console.log(Chalk` {underline Copying Locale Files}`)
            find_locale(dir+config.modulesDir,dir+config.localeDir)
        }
    } catch(error) {
        // logs all errors but ^C
        if (error.message != 'canceled') console.log(Chalk.red(error))
    }
}