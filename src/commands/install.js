// require
const fs = require('fs')
const json_file = '/softmod.json'
const lua_file = '/control.lua'
const valid = require('./../lib/valid')

async function init_dir(dir,override) {
    const scenario = process.argv[1]+'/scenario'
    const files = fs.readdirSync(scenario)
    if (!files) throw new Error('Unable to find scenario template')
    files.forEach(file_name => {
        if (!fs.existsSync(`${scenario}/${file_name}`) || override) {
            if (fs.statSync(`${scenario}/${file_name}`).isDirectory()) {
                if (fs.existsSync(`${scenario}/${file_name}`)) {
                    if (override) {
                        console.log('to do once downloading works, clear dir and remake')
                        /*fs.rmdirSync(`${dir}/${file_name}`)
                        fs.mkdir(`${dir}/${file_name}`,err => {
                            if (err) console.log(`Error creating dir ${fs.realpathSync(dir)}/${file_name}: ${err}`) 
                            else console.log(`Created new dir: ${fs.realpathSync(dir+'/'+file_name)}`)
                        })*/
                    }
                } else {
                    fs.mkdir(`${dir}/${file_name}`,err => {
                        if (err) console.log(`Error creating dir ${fs.realpathSync(dir)}/${file_name}: ${err}`) 
                        else console.log(`Created new dir: ${fs.realpathSync(dir+'/'+file_name)}`)
                    })
                }
            } else {
                fs.copyFile(`${scenario}/${file_name}`,`${dir}/${file_name}`,err => {
                    if (err) console.log(`Error writing file ${fs.realpathSync(dir)}/${file_name}: ${err}`) 
                    else console.log(`Wrote file: ${fs.realpathSync(dir+'/'+file_name)}`)
                })
            }
        }
    })
}

function copy_locale(src,dest) {
    fs.readdir(src,(err,files) => {
        if (err) console.log('Could not read locale dir: '+err)
        else {
            files.forEach(file => {
                if (fs.statSync(`${src}/${file}`).isDirectory()) {
                    if (!fs.existsSync(`${dest}/${file}`)) {console.log(`Created new locale dir: ${file}`); fs.mkdirSync(`${dest}/${file}`)}
                    fs.readdir(`${src}/${file}`,(err,locale_files) => {
                        if (err) console.log('Could not read locale dir: '+err)
                        else {
                            locale_files.forEach(lcoale_file => {
                                if (!fs.statSync(`${src}/${file}/${lcoale_file}`).isDirectory()) {
                                    let file_name = src.indexOf('/modules') > 0 && src.substring(src.indexOf('/modules')+9) || src.indexOf('\\modules') > 0 && src.substring(src.indexOf('\\modules')+9)
                                    file_name = file.substring(0,file.lastIndexOf('.'))+'/'+file_name.replace(/\//g, '.').substring(0,file_name.length-7)
                                    fs.copyFile(`${src}/${file}/${lcoale_file}`,`${dest}/${file}/${file_name}.cfg`,err => {
                                        if (err) console.log(`Failed to copy locale file ${err}`)
                                        else {
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
                    if (!fs.existsSync(`${dest}/${file.substring(0,file.lastIndexOf('.'))}`)) {console.log(`Created new locale dir: ${file.substring(0,file.lastIndexOf('.'))}`); fs.mkdirSync(`${dest}/${file.substring(0,file.lastIndexOf('.'))}`)}
                    let file_name = src.indexOf('/modules') > 0 && src.substring(src.indexOf('/modules')+9) || src.indexOf('\\modules') > 0 && src.substring(src.indexOf('\\modules')+9)
                    file_name = file.substring(0,file.lastIndexOf('.'))+'/'+file_name.replace(/\//g, '.').substring(0,file_name.length-7)
                    fs.copyFile(`${src}/${file}`,`${dest}/${file_name}.cfg`,err => {
                        if (err) console.log(`Failed to copy locale file ${err}`)
                        else {
                            console.log(`Copyed locale file: ${file_name}.cfg`)
                            fs.unlink(`${src}/${file}`,err => {if (err) console.log('Failed to remove locale file: '+err)})
                            fs.rmdir(src,err => {})
                        }
                    })
                }
            })
        } if (files.length === 0) fs.rmdir(src,err => {})
    })
}

function find_locale(src,dest) {
    fs.readdir(src,(err,files) => {
        if (err) console.log('Could not read dir: '+err)
        else {
            files.forEach(file => {
                if (fs.statSync(`${src}/${file}`).isDirectory()) {
                    if (file === 'locale') copy_locale(`${src}/${file}`,dest)
                    else find_locale(`${src}/${file}`,dest)
                }
            })
        }
    })
}

function append_index(index,path,modules) {
    for (let name in modules) {
        const mod = modules[name]
        switch (mod.module) {
            case 'Collection': {
                append_index(index,`${path}/${name}`,mod.submodules)
            } break
            default: {
                if (fs.existsSync(`${path}/${name}`) && fs.existsSync(`${path}/${name}${lua_file}`)) index[mod.module] = `${path}/${name}`
            } break
        }
    }
}

function create_index(dir) {
    const index = {}
    const module_path = `${dir}/modules`
    const index_path = `${dir}/modules/index.lua`
    fs.readdir(module_path,(err,files) => {
        if (err) console.log('Module dir not found')
        else {
            files.forEach(file => {
                if (fs.statSync(`${module_path}/${file}`).isDirectory()) {
                    const mod = fs.readFileSync(`${module_path}/${file}${json_file}`)
                    if (!mod) console.log(`Could not read module ${file}`)
                    else {
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
            let write_str = ''
            for (let module_name in index) {
                const path = index[module_name]
                if (module_name.includes('GlobalLib')) write_str=`    ['${module_name}']='${path}',\n${write_str}`
                else write_str=`${write_str}    ['${module_name}']='${path}',\n`
            }
            fs.writeFile(index_path,`-- not_luadoc=true\n--- Used to index the files to be loaded\nreturn {\n${write_str}}`,err => {
                if (err) console.log(`Error writing file: ${err}`)
                else console.log(`Wrote file: ${fs.realpathSync(index_path)}`)
            })
        }
    }) 
}

module.exports = async (name='.',dir='.',options) => {
    if (options.dryRun) {
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