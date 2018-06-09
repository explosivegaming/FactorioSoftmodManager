// require 
const readline = require('readline')
const fs = require('fs')

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function read_default(dir,key) {
    try {
        const file = dir+'/softmod.json'
        const data = JSON.parse(fs.readFileSync(file,'utf8'))
        return data[key] || undefined
    } catch(error) {
        return undefined
    }
}

function get_input(dir,data,data_key,options,options_key,name,default_value) {
    data[data_key] = options[options_key] || read_default(dir,data_key) || default_value
    if (!options[options_key] && !options.yesAll) {
        rl.question(`Module ${name}: (${data[data_key]}) `,input => data[data_key]=input)
    }
}

function basic(dir,options) {
    const data = []
    const path = fs.realpathSync(dir)
    const dir_name = path.lastIndexOf('/') > 0 && path.substring(path.lastIndexOf('/')+1) || path.lastIndexOf('\\') > 0 && path.substring(path.lastIndexOf('\\')+1) || undefined
    get_input(dir,data,'name',options,'module_name','name',dir_name)
    get_input(dir,data,'version',options,'version','version','1.0.0')
    get_input(dir,data,'module',options,'module','type','Scenario')
    get_input(dir,data,'description',options,'description','description','<blank>')
}

module.exports = (dir='.',options) => {
    const data = []
    basic(dir,options)
    rl.close()
}