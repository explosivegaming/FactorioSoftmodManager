// require 
const Chalk = require('chalk')
const fs = require('fs')
const valid = require('./../lib/valid')

function basic(data){
    console.log(Chalk` {underline ${data.name} - ${data.version} (${data.module})}\n\n  ${data.description}`)
}

function detail(data){
    console.log(Chalk`\n {underline Detail}\n  Author: ${data.author}\n  Contact: ${data.contact}\n  License: ${data.license}\n  Location: ${data.location}`)
}

function array(name,data){
    console.log(Chalk`\n {underline ${name}}:`)
    if (data.length == 0) {console.log('  <none>'); return}
    let count = 0
    let output = []
    data.forEach(name => {
        output.push(name); count++
        if (count > 4) {console.log('  '+output.join(', ')); count=0; output=[]}
    })
    if (output.length > 0) console.log('  '+output.join(', '))
}

module.exports = (path='.',options) => {
    const file = path+'/softmod.json'
    fs.readFile(file,'utf8',(err,data) => {
        // opening error
        if (err) {console.log(`${file} ${err.code === 'ENOENT' ? 'could not be found' : 'was found but cannot to read'}`); return}
        data = JSON.parse(data)
        switch (data.module) {
            case undefined: {
                console.log('Module was not defined in softmod.json')
            } break
            case 'Scenario': {
                if (!valid.secnario(data)) {console.log('Secnario softmod.json was malformed'); break}
                if (options.module[0]) {
                    if (!fs.existsSync(`${path}/modules/${options.module[0]}`)) {console.log('Module not found in scenario'); break}
                    let module_data = fs.readFileSync(`${path}/modules/${options.module[0]}/softmod.json`)
                    if (!module_data) {console.log('Failed to read json file'); break}
                    module_data = JSON.parse(module_data)
                    if (module_data.module === 'Collection') {
                        if (!valid.collection(module_data)) {console.log('Collection softmod.json was malformed'); break}
                        if (options.module[1]) {
                            if (!module_data.submodules[options.module[1]]) {console.log('Submodule not found in collection'); break}
                            let submodule_data = module_data.submodules[options.module[1]]
                            basic(submodule_data)
                            detail(module_data)
                            array('Keywords',submodule_data.keywords)
                            let opt = []; let req = []
                            for (let name in submodule_data.dependencies) {
                                if (submodule_data.dependencies[name].includes('?')) opt.push(name)
                                else req.push(name)
                            }
                            array('Dependencies',req)
                            array('Optinal Dependencies',opt)
                        } else {
                            basic(module_data)
                            detail(module_data)
                            array('Keywords',module_data.keywords)
                            array('Submodules',Object.keys(module_data.submodules))
                        }
                    } else {
                        if (!valid.module(module_data)) {console.log('Module softmod.json was malformed'); break}
                        basic(module_data)
                        detail(module_data)
                        array('Keywords',module_data.keywords)
                        let opt = []; let req = []
                        for (let name in module_data.dependencies) {
                            if (module_data.dependencies[name].includes('?')) opt.push(name)
                            else req.push(name)
                        }
                        array('Dependencies',req)
                        array('Optinal Dependencies',opt)
                    }
                } else {
                    basic(data)
                    array('Modules',Object.keys(data.modules))
                } 
            } break
            case 'Collection': {
                if (!valid.collection(data)) {console.log('Collection softmod.json was malformed'); break}
                if (options.module[0]) {
                    if (!data.submodules[options.module[0]]) {console.log('Submodule not found in collection'); break}
                    let module_data = data.submodules[options.module[0]]
                    basic(module_data)
                    detail(data)
                    array('Keywords',module_data.keywords)
                    let opt = []; let req = []
                    for (let name in module_data.dependencies) {
                        if (module_data.dependencies[name].includes('?')) opt.push(name)
                        else req.push(name)
                    }
                    array('Dependencies',req)
                    array('Optinal Dependencies',opt)
                } else {
                    basic(data)
                    detail(data)
                    array('Keywords',data.keywords)
                    array('Submodules',Object.keys(data.submodules))
                }
            } break
            default: {
                if (!valid.module(data)) {console.log('Module softmod.json was malformed'); break}
                basic(data)
                detail(data)
                array('Keywords',data.keywords)
                let opt = []; let req = []
                for (let name in data.dependencies) {
                    if (data.dependencies[name].includes('?')) opt.push(name)
                    else req.push(name)
                }
                array('Dependencies',req)
                array('Optinal Dependencies',opt)
            } break
        }
        console.log() 
    })
}
