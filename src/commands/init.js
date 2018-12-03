// require 
const promptly = require('promptly')
const consoleLog = require('../lib/consoleLog')

async function getInput(softmod,cmd,inputName,jsonName=inputName,inputNameClean=jsonName,defaultValue='<blank>') {
    // gets a default value for this input
    let defaultInput = cmd[inputName] || softmod.jsonValue(jsonName) || defaultValue
    if (typeof defaultInput === 'object') defaultInput=Object.values(defaultInput).join(',')
    // gets user input
    if (!cmd[inputName]) {
        softmod.json[jsonName] = await promptly.prompt(`Module ${inputNameClean}: (${defaultInput}) `,{trim:false,default:defaultInput})
    } else softmod.json[jsonName] = defaultInput
}

module.exports = async (softmod,cmd) => {
    try {
        await softmod.readJson(true)
        if (!softmod.json) softmod.json = {}
        if (!process.env.skipUserInput) {
            consoleLog('status','Getting user input')
            await getInput(softmod,cmd,'moduleName','name')
            await getInput(softmod,cmd,'moduleVersion','version','version number','1.0.0',this.versionQurey)
            softmod.version = softmod.jsonValue('version')
            await getInput(softmod,cmd,'moduleDescription','description')
            await getInput(softmod,cmd,'author')
            await getInput(softmod,cmd,'contact')
            await getInput(softmod,cmd,'license')
            await getInput(softmod,cmd,'url','location','download url')
            await getInput(softmod,cmd,'keywords')
        }
        consoleLog('status','Building json file')
        await softmod.build(true)
        consoleLog('status','Command Finnished')
    } catch(err) {
        if (err.message != 'canceled') consoleLog('error',err)
    }
}