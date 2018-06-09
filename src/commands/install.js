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
                if (module_name === 'GlobalLib') write_str=`    ['${module_name}']='${path}',\n${write_str}`
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
        // move locales
        create_index(dir)
    } else {
        await init_dir(dir)
        // find module json
        // download modules
        // move locales
        create_index(dir,options.force)
    }
}