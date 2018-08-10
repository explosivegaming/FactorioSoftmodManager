// requires
const valid = require('./valid')
const Chalk = require('chalk')
const config = require('../config.json')
const glob = require('glob')
const fs = require('fs')

// reads the raw data from a json file can accept a dir and then look for the jsonFile in config
function readModuleJson(file,noPrintError) {
    try {
        let readFile = file
        if (fs.existsSync(file)) {
            if (fs.statSync(file).isDirectory()) {
                // if it a dir then it will look for a json file that matched the name of the config name
                if (fs.existsSync(file+config.jsonFile)) readFile = file+config.jsonFile
                else throw new Error('Dir does not contain a module json file: '+file+config.jsonFile)
            }
            // it will then read the selected file, either the given or the one found
            return JSON.parse(fs.readFileSync(readFile))
        }
        return undefined
    } catch(error) {
        // catch any errors
        if (!noPrintError) console.log(Chalk.red(error))
        return undefined
    }
}

// reads a module and gets one value used for one offs
function readModuleValue(dir,key,noPrintError) {
    const data = readModuleJson(dir,noPrintError)
    return data && data[key] || undefined
}

// reads a module and makes sure it is valid before it is returned
function readModuleValid(dir,noPrintError) {
    const data = readModuleJson(dir,noPrintError)
    if (!data) return undefined
    switch (data.type) {
        case undefined: return undefined
        default: return undefined
        case 'Module': {
            if (valid.module(data)) return data
            else return undefined
        }
        case 'Submodule': {
            if (valid.submodule(data)) return data
            else return undefined
        }
        case 'Scenario': {
            if (valid.secnario(data)) return data
            else return undefined
        }
        case 'Collection': {
            if (valid.collection(data)) return data
            else return undefined
        }
    }
}

function getModuleDir(dir,moduleName,useJsons) {
    let search = config.modulesDir
    if (useJsons) search = config.jsonDir
    let moduleNameRaw = moduleName
    if (moduleNameRaw.lastIndexOf('_') > 0) moduleNameRaw = moduleNameRaw.substring(0,moduleNameRaw.lastIndexOf('_'))
    if (moduleNameRaw.lastIndexOf('.') > 0) moduleNameRaw = moduleNameRaw.substring(moduleNameRaw.lastIndexOf('.')+1)
    return glob.sync(dir+search+'/**/'+moduleNameRaw+'*')
}

function getModulesVersions(dir,moduleName,useJsons) {
    const paths = getModuleDir(dir,moduleName,useJsons)
    const rtn = []
    paths.forEach(path => rtn.push(path.substring(path.lastIndexOf('_')+1).replace(/-/gi,'.')))
    return rtn
}

module.exports = {
    raw: readModuleJson,
    getValue: readModuleValue,
    json: readModuleValid,
    path: getModuleDir,
    versions: getModulesVersions
}