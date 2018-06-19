// require 
const Chalk = require('chalk')
const fs = require('fs')
const config = require('../config.json')
const reader = require('../lib/reader')
const valid = require('../lib/valid')

// logs basic detail all jsons will have
function basic(data){
    console.log(Chalk` {underline ${data.name} - ${data.version} (${data.module})}\n\n  ${data.description}`)
}

// logs detail that some jsons will have
function detail(data){
    console.log(Chalk`\n {underline Detail}\n  Author: ${data.author}\n  Contact: ${data.contact}\n  License: ${data.license}\n  Location: ${data.location}`)
}

// logs an array of data in a clean format
function array(name,data){
    console.log(Chalk`\n {underline ${name}}:`)
    // if empty it will display <none>
    if (data.length == 0) {console.log('  <none>'); return}
    let count = 0
    let output = []
    // the arrayes will have 5 items per line
    data.forEach(name => {
        output.push(name); count++
        if (count > 4) {console.log('  '+output.join(', ')); count=0; output=[]}
    })
    if (output.length > 0) console.log('  '+output.join(', '))
}

// emits to the log module data
function module_emit(module_data,collection) {
    // cheaks json is valid
    if ((!collection && !valid.module(module_data)) || (collection && !valid.submodule(module_data))) {console.log('Module softmod.json was malformed'); return}
    basic(module_data)
    // if it was called from a collection then it will use the collection detail
    if (collection) detail(collection)
    else detail(module_data)
    array('Keywords',module_data.keywords)
    // splits the dependencies between required and optinal
    let opt = []; let req = []
    for (let name in module_data.dependencies) {
        if (module_data.dependencies[name].includes('?')) opt.push(name)
        else req.push(name)
    }
    array('Dependencies',req)
    array('Optinal Dependencies',opt)
}

function collection_emit(module_data,sub_module) {
    // cheaks json is valid
    if (!valid.collection(module_data)) {console.log('Collection softmod.json was malformed'); return}
    // if a submodule is asked for then it will emit that instead
    if (sub_module) {
        if (!module_data.submodules[sub_module]) {console.log('Submodule not found in collection'); return}
        module_emit(module_data.submodules[sub_module],module_data)
    } else {
        basic(module_data)
        detail(module_data)
        array('Keywords',module_data.keywords)
        array('Submodules',Object.keys(module_data.submodules))
    }
}

module.exports = (dir='.',options) => {
    // reads the selected json file
    const data = reader.json(dir+config.jsonFile)
    if (!data) {console.log(Chalk.red('Could not read json file')); return}
    switch (data.type) {
        default:
        case undefined: {
            // handles a undefined value for module in side the json
            console.log('Module Type was undefined in softmod.json')
        } break
        case 'Scenario': {
            // cheaks json is valid
            if (!valid.secnario(data)) {console.log('Secnario softmod.json was malformed'); break}
            // if -m was used it will get a data on a module of the sencatio
            if (options.module[0]) {
                // cheaks the module exists and is valid
                if (!fs.existsSync(`${dir}${config.modulesDir}/${options.module[0]}`)) {console.log('Module not found in scenario'); break}
                const module_data = reader.json(`${dir}${config.modulesDir}/${options.module[0]}${config.jsonFile}`)
                // cheaks is it is a collection to cheak for a second submodule
                if (module_data.type == 'Collection') {
                    if (options.module[1]) collection_emit(module_data,options.module[1])
                    else collection_emit(module_data)
                } else module_emit(module_data)
            } else {
                // if no module asked for then it just depalys basic information
                basic(data)
                array('Modules',Object.keys(data.modules))
            } 
        } break
        case 'Collection': {
            collection_emit(data,options.module[0])
        } break
        case 'Submodule':
        case 'Module': {
            // deafult is any module name
            module_emit(data)
        } break
    }
    // empty line looks nice
    console.log() 
}
