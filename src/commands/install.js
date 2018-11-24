// require
const fs = require('fs')
const Chalk = require('chalk')
const promptly = require('promptly')
const config = require('../config.json')
const Version = require('../lib/version')
const Downloader = require('../lib/downloader')
const reader = require('../lib/reader')
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
    for (let i = 0; i < files.length; i++) {
        let file_name = files[i]
        await new Promise((resolve,reject) => {
            if (!fs.existsSync(`${dir}/${file_name}`) || force) {
                // if it does not exist or if force flag is set
                if (fs.statSync(`${scenario}/${file_name}`).isDirectory()) {
                    // if it is a dir
                    if (!fs.existsSync(`${dir}/${file_name}`)) {
                        // if the dir is not present in the dest dir then it is made
                        fs.mkdir(`${dir}/${file_name}`,err => {
                            if (err) console.log(Chalk`{red Error creating dir ${fs.realpathSync(dir)}/${file_name}: ${err}}`) 
                            else console.log(`  Created new dir: ${fs.realpathSync(dir+'/'+file_name)}`)
                            resolve()
                        }) 
                    } else {
                        // need a way to remove the dir sync or like wise so it can be remake
                        resolve()
                    }
                } else {
                    // if it is a file then it is copyed, must not already exist
                    fs.copyFile(`${scenario}/${file_name}`,`${dir}/${file_name}`,err => {
                        if (err) console.log(Chalk`{red Error writing file ${fs.realpathSync(dir)}/${file_name}: ${err}}`) 
                        else console.log(`  Wrote file: ${fs.realpathSync(dir+'/'+file_name)}`)
                        resolve()
                    })
                }
            } else resolve()
        }).catch(err => console.log(Chalk.red(err)))
    }
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

// creates the lua index file after searching modules dir
function create_index(dir) {
    const index = []
    const module_path = dir+config.modulesDir
    const index_path = module_path+config.modulesIndex
    // reads the modules dir
    return new Promise(async (resolve,reject) => {
        console.log('  Generating tree...')
        const installedModulesTree = await Tree.dependenciesOffline(dir)
        const installedModules = Tree.flatten(installedModulesTree)
        console.log('  Generating module order...')
        for (let moduleName in installedModules) {
            if (!moduleName.includes('?')) {
                let currentIndex = 0
                installedModules[moduleName].forEach(subModule => {
                    const subversions = reader.installedVersions(dir,subModule)
                    subModuleName = subModule.substring(0,subModule.lastIndexOf('_'))
                    subversions.forEach(subModVersion => {
                        const possibleVersions = index.filter(value => value.includes(subModuleName)).map(value => Version.extract(value))
                        const foundVersion = Version.match(possibleVersions,subModVersion,true)
                        const subMod = subModuleName+'_'+foundVersion
                        if (index.indexOf(subMod) && !foundVersion.includes('?')) {
                            if (currentIndex < index.indexOf(subMod)) currentIndex = index.indexOf(subMod)+1
                        }
                    })
                })
                console.log(Chalk.gray(`   Inserted{${currentIndex}} ${moduleName}`))
                index.splice(currentIndex,0,moduleName)
            }
        }
        // once all modules are added it will create the lua file
        let write_str = ''
        // first loops over each index and creates a string of the index object in a lua friendly way
        console.log('  Finding module paths...')
        index.forEach(module_name => {
            const modulePaths = reader.path(dir,module_name)
            // this part works as the module name has a version attatched to it
            const versions = modulePaths.map(value => Version.extract(value).replace(/-/gi,'.'))
            const foundVersion = Version.match(versions,Version.extract(module_name),true)
            const module_path = modulePaths[versions.indexOf(foundVersion)]
            const moduleNameRaw = module_name.replace('_','@')
            console.log(Chalk`   Added ${moduleNameRaw} {gray ${module_path}}`)
            write_str=write_str+(config.indexBody.replace('${module_name}',moduleNameRaw).replace('${module_path}',module_path))
        })
        // once it has formed the string it will add the header and footer to the file and create the file
        fs.writeFile(index_path,config.indexHeader+write_str+config.indexFooter,err => {
            if (err) reject(`Error writing file: ${err}`)
            else console.log(`  Wrote file: ${fs.realpathSync(index_path)}`)
            resolve()
        })
    }).catch(err => console.log(Chalk.red(err)))
}

// gets the next json file from the queue, used to find latest versions for modules
async function getVersions(dir,index,queue,opt_modules,failed_modules,installed_modules,use_force) {
    const next = queue.pop()
    const [name,version] = Version.extract(next,true)
    // if the module is already installed then it will skip the module and add it to the installed list
    if (installed_modules[name]) return
    // if this lookup as failed previously it will not try again
    if (failed_modules[next]) return
    // gets the json file for the version lookup
    console.log(`  Getting Json for ${name}_${version}...`)
    const json = await Downloader.getJson(dir,name,version)
    if (!json) failed_modules[next] = true
    // once the version required is knowen it is checked if it is installed
    if (reader.installedVersions(dir,name).includes(json.version)) {
        if (use_force) rmdir(reader.path(dir,name)[reader.installedVersions(dir,name).indexOf(json.version)])
        else {installed_modules.push(name);return}
    }
    // adds avibile versions to a lookup index
    if (index[name]) index[name].push(json.version)
    else index[name] = [json.version]
    let modules = []
    // depending on what type of module it is then it will require different validation
    switch (json.type) {
        case 'Submodule':
        case 'Module': modules = json.dependencies; break
        case 'Scenario': modules = json.modules; break
        case 'Collection': for (let moduleName in json.submodules) modules[name+'.'+moduleName] = json.submodules[moduleName].version; break
    }
    // the modules are sorted based on wheather their are optional or not
    for (let moduleName in modules) {
        // if the dependency is optional this module is added to the list that request the module (if it is not required bu another)
        if (modules[moduleName].includes('?') && typeof opt_modules[moduleName] != 'boolean') if(opt_modules[moduleName]) {opt_modules[moduleName].push(name+'_'+json.version)} else {opt_modules[moduleName] = [name+'_'+json.version]}
        // if this dependency is required then it will be marked as such
        else if(opt_modules[moduleName] != true) opt_modules[moduleName] = false
    }
}

// creates the download queue to be used by the downloader
async function create_download_queue(dir,queue,index,opt_modules,yes_all) {
    // loops or the index which was created by the json lookups
    for (let module_name in index) {
        const done = []
        for (let i = 0; i < index[module_name].length; i++) {
            const version = index[module_name][i]
            if (!done.includes(version) && opt_modules[module_name] != true) {
                done.push(version)
                let install = true
                // if the module is optional then the user is asked if it should be installed, unless _y is given
                if (opt_modules[module_name] && !yes_all) {
                    console.log(`  ${module_name}_${version} has been requested by ${opt_modules[module_name].length} other modules as an optinal dependiency.`)
                    if (!await promptly.confirm(Chalk`   Would you like to install this module: (yes)`,{default:'yes'})) install = false
                }
                // either gets the json for a version or reads the chached one to get the download location
                if (install) {
                    await new Promise(async (resolve,reject) => {
                        const json = await Downloader.getJson(dir,module_name,version)
                        // adds the module to the download queue and saves this version of the json
                        queue.push([module_name,json.version])
                        console.log(Chalk`  Added ${module_name} Version ${json.version}: {grey ${json.location}}`)
                        resolve()
                    }).catch(err => console.log(Chalk.red(err)))
                }
            }
        }
    }
}

module.exports = async (name='.',options) => {
    const dir = process.env.dir
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
            let index_queue = []
            const download_queue = []
            const index = {}
            const failed_modules = {}
            const installed_modules = []
            const opt_modules = {}
            // if there is no module name but there is a dir path then the values are switched
            if (name.includes('/') || name.includes('\\') && dir == '.') {dir = name;name='.'}
            // if no module is given then it will look in the current dir to find a module json
            if (name == '.') {
                if (fs.existsSync(name+config.jsonFile) && fs.statSync(name+config.jsonFile).isFile()) {
                    const json = JSON.parse(fs.readFileSync(name+config.jsonFile))
                    if (json.type == 'Scenario') {
                        index_queue.pop()
                        for (let moduleName in json.modules) index_queue = index_queue.concat(Tree.module.dependencies(dir,moduleName,json.modules[module_name]))
                    }
                }
            } else {
                // adds the requested modules and version and all of the required modules into the queue
                let [moduleName,moduleVersion] = Version.extract(name,true)
                if (options.moduleVersion) moduleVersion = options.moduleVersion
                index_queue = await Tree.module.dependencies(dir,moduleName,moduleVersion)
                index_queue.push(moduleName+'_'+moduleVersion)
            }
            // starts install
            console.log(Chalk` {underline Initiating Scenario Dir}`)
            await init_dir(dir)
            console.log(Chalk` {underline Finding Module Versions}`)
            while (index_queue.length > 0) await getVersions(dir,index,index_queue,opt_modules,failed_modules,installed_modules,options.force)
            // warning message if there were modules already installed that were requested
            if (installed_modules.length > 0) {
                console.log(Chalk.red('  The following modules were skiped due to them already being installed: '))
                console.log(Chalk.grey('   '+installed_modules.join(', ')))
                console.log(Chalk.red('  Please use -f to force a reinstall of all modules'))
            }
            // creates a download queue and then downloads the modules
            console.log(Chalk` {underline Selecting Download Versions}`)
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