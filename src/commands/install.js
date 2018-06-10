// require
const fs = require('fs')
const json_file = '/softmod.json'
const lua_file = '/control.lua'
const valid = require('./../lib/valid')

// copies scenario dir to the install dir
async function init_dir(dir,force) {
    const scenario = process.argv[1]+'/scenario'
    const files = fs.readdirSync(scenario)
    if (!files) throw new Error('Unable to find scenario template')
    // loop over files in scenario dir
    files.forEach(file_name => {
        if (!fs.existsSync(`${scenario}/${file_name}`) || force) {
            // if it does not exist or if force flag is set
            if (fs.statSync(`${scenario}/${file_name}`).isDirectory()) {
                // if it is a dir
                if (fs.existsSync(`${scenario}/${file_name}`)) {
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
                        if (err) console.log(`Error creating dir ${fs.realpathSync(dir)}/${file_name}: ${err}`) 
                        else console.log(`Created new dir: ${fs.realpathSync(dir+'/'+file_name)}`)
                    })
                }
            } else {
                // if it is a file then it is copyed, must not already exist
                fs.copyFile(`${scenario}/${file_name}`,`${dir}/${file_name}`,err => {
                    if (err) console.log(`Error writing file ${fs.realpathSync(dir)}/${file_name}: ${err}`) 
                    else console.log(`Wrote file: ${fs.realpathSync(dir+'/'+file_name)}`)
                })
            }
        }
    })
}

// copies and then deletes the locale files of a module, can be a folders or files nammed by the locale eg en or fr
function copy_locale(src,dest) {
    // src must have been cheaked as vaild already
    fs.readdir(src,(err,files) => {
        if (err) console.log('Could not read locale dir: '+err)
        else {
            // loops over files in the locale
            files.forEach(file => {
                if (fs.statSync(`${src}/${file}`).isDirectory()) {
                    // if it is a dir, creates a new dir in locale if it is not already present
                    if (!fs.existsSync(`${dest}/${file}`)) {console.log(`Created new locale dir: ${file}`); fs.mkdirSync(`${dest}/${file}`)}
                    // reads this sub locale dir to get the cfg files
                    fs.readdir(`${src}/${file}`,(err,locale_files) => {
                        if (err) console.log('Could not read locale dir: '+err)
                        else {
                            // loops over cfg files in sub locale dir
                            locale_files.forEach(lcoale_file => {
                                // only copies files, will not look in sub dirs of the sub locale dir
                                if (!fs.statSync(`${src}/${file}/${lcoale_file}`).isDirectory()) {
                                    // generates a file name for the locale cfg file, the module name/location
                                    let file_name = src.indexOf('/modules') > 0 && src.substring(src.indexOf('/modules')+9) || src.indexOf('\\modules') > 0 && src.substring(src.indexOf('\\modules')+9)
                                    file_name = file.substring(0,file.lastIndexOf('.'))+'/'+file_name.replace(/\//g, '.').substring(0,file_name.length-7)
                                    // copies the file under this new name
                                    fs.copyFile(`${src}/${file}/${lcoale_file}`,`${dest}/${file}/${file_name}.cfg`,err => {
                                        if (err) console.log(`Failed to copy locale file ${err}`)
                                        else {
                                            // will keep attempting to remove the dir once the file is copied and removed
                                            console.log(`Copyed locale file: ${file_name}.cfg`)
                                            fs.unlink(`${src}/${file}/${lcoale_file}`,err => {if (err) console.log('Failed to remove locale file: '+err)})
                                            fs.rmdir(`${src}/${file}`,err => {})
                                            fs.rmdir(src,err => {})
                                        }
                                    })
                                }
                            })
                        }
                    })
                } else {
                    // if it is a file, will create a a new dir of the name of the cfg file in locale if not already made
                    if (!fs.existsSync(`${dest}/${file.substring(0,file.lastIndexOf('.'))}`)) {console.log(`Created new locale dir: ${file.substring(0,file.lastIndexOf('.'))}`); fs.mkdirSync(`${dest}/${file.substring(0,file.lastIndexOf('.'))}`)}
                    // generates a file name for the locale cfg file, the module name/location
                    let file_name = src.indexOf('/modules') > 0 && src.substring(src.indexOf('/modules')+9) || src.indexOf('\\modules') > 0 && src.substring(src.indexOf('\\modules')+9)
                    file_name = file.substring(0,file.lastIndexOf('.'))+'/'+file_name.replace(/\//g, '.').substring(0,file_name.length-7)
                    // copies the file under this new name
                    fs.copyFile(`${src}/${file}`,`${dest}/${file_name}.cfg`,err => {
                        if (err) console.log(`Failed to copy locale file ${err}`)
                        else {
                            // will keep attempting to remove the dir once the file is copied and removed
                            console.log(`Copyed locale file: ${file_name}.cfg`)
                            fs.unlink(`${src}/${file}`,err => {if (err) console.log('Failed to remove locale file: '+err)})
                            fs.rmdir(src,err => {})
                        }
                    })
                }
            })
        } if (files.length === 0) fs.rmdir(src,err => {}) // if the locale dir were already emtpy then they are removed
    })
}

// a recersive lookup for any locale files for modules, will not look in sub dir of the locale dir
function find_locale(src,dest) {
    // src must have been cheaked as vaild already
    fs.readdir(src,(err,files) => {
        if (err) console.log('Could not read dir: '+err)
        else {
            // loops over all files in the dir
            files.forEach(file => {
                if (fs.statSync(`${src}/${file}`).isDirectory()) {
                    // if it is a dir then it will cheak the name, else look at the sub dirs
                    if (file === 'locale') copy_locale(`${src}/${file}`,dest)
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
                if (fs.existsSync(`${path}/${name}`) && fs.existsSync(`${path}/${name}${lua_file}`)) index[mod.module] = `${path}/${name}`
            } break
        }
    }
}

// creates the lua index file after searching modules dir
function create_index(dir) {
    const index = {}
    const module_path = `${dir}/modules`
    const index_path = `${dir}/modules/index.lua`
    // reads the modules dir
    fs.readdir(module_path,(err,files) => {
        if (err) console.log('Module dir not found')
        else {
            // loops over files in the module dir
            files.forEach(file => {
                if (fs.statSync(`${module_path}/${file}`).isDirectory()) {
                    // if it is a dir then it will try to read the json file
                    const mod = fs.readFileSync(`${module_path}/${file}${json_file}`)
                    if (!mod) console.log(`Could not read module ${file}`)
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
                const path = index[module_name]
                // if it has GlobalLib in its name then it is put at the front of the index
                if (module_name.includes('GlobalLib')) write_str=`    ['${module_name}']='${path}',\n${write_str}`
                else write_str=`${write_str}    ['${module_name}']='${path}',\n`
            }
            // once it has formed the string it will add the header and footer to the file and create the file
            fs.writeFile(index_path,`-- not_luadoc=true\n--- Used to index the files to be loaded\nreturn {\n${write_str}}`,err => {
                if (err) console.log(`Error writing file: ${err}`)
                else console.log(`Wrote file: ${fs.realpathSync(index_path)}`)
            })
        }
    }) 
}

module.exports = async (name='.',dir='.',options) => {
    if (options.dryRun) {
        // will not download anything
        await init_dir(dir,options.force)
        find_locale(`${dir}/modules`,`${dir}/locale`)
        create_index(dir)
    } else {
        await init_dir(dir)
        // find module json
        // download modules
        find_locale(`${dir}/modules`,`${dir}/locale`)
        create_index(dir,options.force)
    }
}