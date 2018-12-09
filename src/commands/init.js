// require 
const promptly = require('promptly')
const fs = require('fs-extra')
const consoleLog = require('../lib/consoleLog')
const config = require('../config')

async function getInput(softmod,cmd,inputName,jsonName=inputName,inputNameClean=jsonName,defaultValue='<blank>') {
    // gets a default value for this input
    let defaultInput = cmd[inputName] || softmod.jsonValue(jsonName) || defaultValue
    if (typeof defaultInput === 'object') defaultInput=Object.values(defaultInput).join(',')
    // gets user input
    if (!cmd[inputName]) {
        softmod.json[jsonName] = await promptly.prompt(`Module ${inputNameClean}: (${defaultInput}) `,{trim:false,default:defaultInput})
        if (softmod.json[jsonName] == '<blank>') delete softmod.json[jsonName]
    } else softmod.json[jsonName] = defaultInput
}

module.exports = async (softmod,cmd) => {
    try {
        if (cmd.scenario) softmod.isScenario = true
        fs.ensureDir(softmod.downloadPath)
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
            if (!softmod.isScenario) await getInput(softmod,cmd,'url','location','download url','FSM_ARCHIVE')
            await getInput(softmod,cmd,'keywords')
            if (softmod.json.keywords) softmod.json.keywords = softmod.json.keywords.split(',').map(s => s.trim())
        }
        consoleLog('status','Building json file')
        await softmod.build(true,false,true)
        if (!softmod.isScenario && !fs.existsSync(softmod.downloadPath+config.luaFile)) {
            consoleLog('info','Cloning boilerprint module code')
            const installLocation = process.argv[1]+config.srcScenario+config.modulesDir
            // reads the boiler print and replaces BOILER_INIT tags
            let promise
            fs.readFile(installLocation+'/module-control.lua',(err,data) => {
                if (err) consoleLog('error',err)
                else {
                    data = data.toString()
                        .replace('BOILER_INIT${moduleDescription}',softmod.jsonValue('description'))
                        .replace('BOILER_INIT${moduleName}',softmod.versionName)
                        .replace('BOILER_INIT${moduleAuthor}',softmod.jsonValue('author'))
                        .replace('BOILER_INIT${moduleLicense}',softmod.jsonValue('license'))
                }
                promise = fs.writeFile(softmod.downloadPath+config.luaFile,data)
            })
            await promise
        }
        consoleLog('status','Command Finnished')
    } catch(err) {
        if (err.message != 'canceled') consoleLog('error',err)
    }
}