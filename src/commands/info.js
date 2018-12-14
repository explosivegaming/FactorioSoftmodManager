// require 
const chalk = require('chalk')
const {consoleLog,errorLog,finaliseLog} = require('../lib/consoleLog')

function capFirst(string) {
    return string.charAt(0).toUpperCase()+string.toLowerCase().slice(1)
}

function treeToString(tree,opt,firstLevelPrefix,nextLevelPrefix,depth=0) {
    let output = ''
    for (let softmodName in tree) {
        const softmod = tree[softmodName]
        if (!softmod.versionName) output+=firstLevelPrefix+'   '+softmodName+'\n'+treeToString(softmod,opt,firstLevelPrefix,nextLevelPrefix,depth+1)
        else {
            output+=firstLevelPrefix
            let index = 0
            if (softmod.installed) index++
            if (opt.includes(softmod.name)) index+=2
            output+=(['-- ','#- ','-? ','#? '])[index]+nextLevelPrefix.repeat(depth)
            if (depth > 0) output+=' '
            output+=softmod.versionName+'\n'
        }
    }
    return output
}

module.exports = async (softmod,cmd) => {
    consoleLog('status','Generating Preview...')
    if (process.env.download) await softmod.updateFromJson()
    if (!softmod.version) {
        consoleLog('error','Could not download or read json for: '+softmod.versionName)
        return
    }
    const deatils = ['author','contact','license','location']
    const dependencies = softmod.dependencies
    const dependenciesTree = {}
    const optDependencies = []
    const reqDependencies = []
    const submodules = softmod.submodules
    consoleLog('info','Finding submodules')
    await Promise.all(submodules.map(submod => submod.updateFromJson())) // may download files, depends on download settings
    // adds submodule dependencies to the overall dependencies array
    submodules.forEach(submod => {
        consoleLog('info','Added '+submod.name)
        submod.dependencies.forEach(dep => {
            if (!dep.name.includes(softmod.name)) dependencies.push(dep)
        })
    })
    // sorts them into a tree structure
    consoleLog('info','Finding dependencies')
    dependencies.forEach(submod => {
        // makes tree structure
        const path = submod.name.split('.')
        let currentPath = dependenciesTree
        path.forEach((part,index) => {
            if (!currentPath[part]) currentPath[part] = {}
            if (index == path.length-1) currentPath[part] = submod
            else currentPath = currentPath[part]
        })
        // makes things as opt vs req
        if (submod.versionQurey.includes('?')) {
            if (!optDependencies.includes(submod.name) && !reqDependencies.includes(submod.name)) {
                optDependencies.push(submod.name)
            }
        } else if (optDependencies.includes(submod.name)) {
            optDependencies.splice(optDependencies.indexOf(submod.name),1)
            reqDependencies.push(submod.name)
        } else if (!reqDependencies.includes(submod.name)) {
            reqDependencies.push(submod.name)
        }
    })
    consoleLog('info',`Found ${dependencies.length} possible dependencies`)
    consoleLog('info','Converting dependency tree to string')
    const depTreeString = treeToString(dependenciesTree,optDependencies,'  ','_>')
    // displays the generated infomation
    consoleLog('success','Displaying Preview:')
    console.log(chalk` {cyan {underline ${softmod.versionName} (${softmod.jsonValue('author')})}}\n\n  ${softmod.jsonValue('description')}`)
    console.log(chalk`\n {cyan {underline Details:}}`) 
    deatils.forEach(detail => {
        if (softmod.jsonValue(detail)) console.log(chalk`  ${capFirst(detail)}: ${softmod.jsonValue(detail)}`)
    })
    if (softmod.jsonValue('keywords')) console.log('  Keywords: '+softmod.jsonValue('keywords').join(', '))
    if (dependencies.length > 0) console.log(chalk`\n {cyan {underline Dependencies:}}\n${depTreeString}`)
    if (submodules.length > 0) {
        console.log(chalk`\n {cyan {underline Submodules:}}`)
        submodules.forEach(submod => {
            console.log(chalk`  ${submod.name.replace(softmod.name+'.','')}: ${submod.jsonValue('description')}`)
        })
    }
    finaliseLog()
}
