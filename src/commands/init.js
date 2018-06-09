// require 
const promptly = require('promptly')
const fs = require('fs')

function read_default(dir,key) {
    try {
        const file = dir+'/softmod.json'
        const data = JSON.parse(fs.readFileSync(file,'utf8'))
        return data[key] || undefined
    } catch(error) {
        return undefined
    }
}

async function get_input(dir,data,data_key,options,options_key,name,default_value) {
    const default_input = options[options_key] || read_default(dir,data_key) || default_value
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

module.exports = async (dir='.',options) => {
    try {
        const data = []
        await basic(dir,data,options)
        console.log(data)
    } catch(error) {
        if (!error.message === 'canceled') console.log(error)
    }
}