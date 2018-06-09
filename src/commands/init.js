// require 
const promptly = require('promptly')
const fs = require('fs')
const valid = require('./../lib/valid')
const josn_file = '/softmod.json'

function read_default(dir,key) {
    try {
        const file = dir+josn_file
        const data = JSON.parse(fs.readFileSync(file,'utf8'))
        return data[key] || undefined
    } catch(error) {
        return undefined
    }
}

async function get_input(dir,data,data_key,options,options_key,name,default_value) {
    let default_input = options[options_key] || read_default(dir,data_key) || default_value
    if (typeof default_input === 'object') default_input=Object.values(default_input).join(',')
    if (!options[options_key] && !options.yesAll) {
        data[data_key] = await promptly.prompt(`Module ${name}: (${default_input}) `,{trim:false,default:default_input})
    } else data[data_key]=default_input
}

async function basic(dir,data,options) {
    const path = fs.realpathSync(dir)
    const dir_name = path.lastIndexOf('/') > 0 && path.substring(path.lastIndexOf('/')+1) || path.lastIndexOf('\\') > 0 && path.substring(path.lastIndexOf('\\')+1) || undefined
    await get_input(dir,data,'name',options,'moduleName','name',dir_name)
    await get_input(dir,data,'version',options,'moduleVersion','version','1.0.0')
    await get_input(dir,data,'module',options,'module','type','Scenario')
    await get_input(dir,data,'description',options,undefined,'description','<blank>')
}

async function basic(dir,data,options) {
    const path = fs.realpathSync(dir)
    const dir_name = path.lastIndexOf('/') > 0 && path.substring(path.lastIndexOf('/')+1) || path.lastIndexOf('\\') > 0 && path.substring(path.lastIndexOf('\\')+1) || undefined
    await get_input(dir,data,'name',options,'moduleName','name',dir_name)
    await get_input(dir,data,'version',options,'moduleVersion','version','1.0.0')
    await get_input(dir,data,'module',options,'module','type','Scenario')
    await get_input(dir,data,'description',options,undefined,'description','<blank>')
}

async function detail(dir,data,options) {
    await get_input(dir,data,'location',options,'url','location url','<blank>')
    await get_input(dir,data,'keywords',options,'keyWords','keywords','<blank>')
    data.keywords = data.keywords.split(',')
    await get_input(dir,data,'author',options,'author','author','<blank>')
    await get_input(dir,data,'contact',options,'contact','contact','<blank>')
    await get_input(dir,data,'license',options,'license','license','<blank>')
}

module.exports = async (dir='.',options) => {
    try {
        const data = {}
        await basic(dir,data,options)
        switch (data.module) {
            case 'Scenario': {
                data.modules = read_default(dir,'modules') || {}
                const module_dir = dir+'/modules'
                const files = fs.readdirSync(module_dir)
                if (!files) {console.log('Skiping module loading, modules dir not found'); break}
                files.forEach(dir_name => {
                    if (fs.statSync(`${module_dir}/${dir_name}`).isDirectory()) {
                        const name = read_default(`${module_dir}/${dir_name}`,'name')
                        if (name) {
                            const version = read_default(`${module_dir}/${dir_name}`,'version')
                            if (version) {
                                data.modules[name] = `^${version}`
                            }
                        }
                    }
                })
            } break
            case 'Collection': {
                await detail(dir,data,options)
                data.submodules = read_default(dir,'submodules') || {}
                const module_dir = dir
                const files = fs.readdirSync(module_dir)
                if (!files) {console.log('Skiping module loading, modules dir not found'); break}
                files.forEach(dir_name => {
                    if (fs.statSync(`${module_dir}/${dir_name}`).isDirectory()) {
                        const name = read_default(`${module_dir}/${dir_name}`,'name')
                        if (name) {
                            const module_data = JSON.parse(fs.readFileSync(`${module_dir}/${dir_name}/${josn_file}`))
                            if (valid.submodule(module_data)) data.submodules[name] = module_data
                        }
                    }
                })
                for (let submodule_name in data.submodules) if (!valid.submodule(data.submodules[submodule_name])) delete data.submodules[submodule_name]
            } break
            default:

        }
        fs.writeFile(dir+josn_file,JSON.stringify(data,undefined,4),err => {
            if (err) console.log(`Error writing file: ${err}`) 
            else console.log(`Worte file: ${fs.realpathSync(dir+josn_file)}`)
        })
    } catch(error) {
        if (error.message != 'canceled') console.log(error)
    }
}