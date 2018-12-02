const fs = require('fs-extra')
const promptly = require('promptly')
const config = require('../config.json')

const consoleLog = require('../lib/consoleLog')
const Softmod = require('../lib/Softmod')

const rootDir = process.env.dir

async function addSoftmodToDependencies(submod,dependencies,checked,forceRecur) {
    if (submod.installed && !checked.includes(submod.name)) {
        if (forceRecur || !dependencies.includes(submod.name)) {
            dependencies.push(submod.name)
            await getDependencies(submod,dependencies,checked)
        }
    }
    if (!checked.includes(submod.name)) checked.push(submod.name)
}

async function getDependencies(softmod,dependencies=[],checked=[softmod.name]) {
    await softmod.readJson(true)
    const subs = softmod.submodules
    subs.forEach(submod => {if (submod.installed) dependencies.push(submod.name)})
    for (let i = 0;i < subs.length;i++) await addSoftmodToDependencies(subs[i],dependencies,checked,true)
    const deps = softmod.dependencies
    for (let i = 0;i < deps.length;i++) await addSoftmodToDependencies(deps[i],dependencies,checked)
    if (softmod.collection && !dependencies.includes(softmod.collection.name)) await dependencies.push(softmod.collection.name)
    consoleLog('info','Checked dependencies for: '+softmod.name)
    return dependencies
}

async function addSoftmodToInstalled(softmod,installed) {
    if (Object.keys(installed).includes(softmod.name)) return
    await softmod.updateFromJson(true)
    if (softmod.installed) {
        consoleLog('info',`${softmod.name} is currently installed`)
        installed[softmod.name] = softmod
        await Promise.all(softmod.submodules.map(submod => addSoftmodToInstalled(submod,installed)))
    }
}

function getInstalled() {
    const installed = {}
    return new Promise((resolve,reject) => {
        fs.readdir(rootDir+config.modulesDir,async (err,files) => {
            await Promise.all(files.map(file => {
                if (fs.statSync(`${rootDir+config.modulesDir}/${file}`).isDirectory()) {
                    const softmodJson = fs.readJSONSync(`${rootDir+config.modulesDir}/${file}/${config.jsonFile}`,{throws:false})
                    if (softmodJson) {
                        const softmod = Softmod.fromJson(softmodJson)
                        return addSoftmodToInstalled(softmod,installed)
                    }
                }
            }))
            resolve(installed)
        })
    }).catch(err => consoleLog('error',err))
}

module.exports = async (softmod,cmd) => {
    try {
        if (cmd.clearJsons) {
            consoleLog('status','Removing temp json dir.')
            fs.removeSync(rootDir+config.jsonDir)
            consoleLog('status','Command Finnished')
            return
        }
        if (cmd.all) {
            consoleLog('status','Restroing scenario to default.')
            fs.emptyDirSync(rootDir)
            const scenario = process.argv[1]+config.srcScenario+config.modulesDir+'/default-factorio-control.lua'
            fs.copySync(scenario,rootDir+config.luaFile)
            consoleLog('status','Command Finnished')
            return
        }
        if (!softmod.installed && !process.env.useForce) throw new Error('Module not installed')
        if (!cmd.recursion) {
            consoleLog('status','Uninstalling softmod.')
            softmod.uninstall(false)
        } else {
            const skip = []
            consoleLog('status','Getting dependencies.')
            const dependencies = await getDependencies(softmod)
            consoleLog('status','Getting installed modules.')
            const installed = await getInstalled()
            Object.values(installed).filter(submod => !dependencies.includes(submod.name) && submod.name != softmod.name).forEach(submod => {
                submod.dependencies.forEach(dep => {
                    if ((dependencies.includes(dep.name) || dep.name == submod.collection.name) && !skip.includes(dep.name)) {
                        skip.push(dep.name)
                        const depParent = installed[dep.name].collection
                        if (depParent && dependencies.includes(depParent.name)) skip.push(depParent.name)
                    }
                })
            })
            consoleLog('input','The following modules will be uninstalled: ')
            console.log(dependencies.filter(value => !skip.includes(value)).join(', '))
            let userInput = true
            if (!process.env.skipUserInput) userInput = await promptly.confirm('Would you like to continue the uninstall: (yes)',{default:'yes'})
            if (!userInput) throw new Error('canceled')
            await softmod.uninstall(true,skip)
        }
        consoleLog('status','Command Finnished')
    } catch(err) {
        if (err.message != 'canceled') consoleLog('error',err)
    }
}