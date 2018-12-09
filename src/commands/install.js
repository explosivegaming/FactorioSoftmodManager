// require
const fs = require('fs-extra')
const promptly = require('promptly')
const config = require('../config.json')

const Softmod = require('../lib/Softmod')
const consoleLog = require('../lib/consoleLog')

const rootDir = process.env.dir

function initDir() {
    return new Promise((resovle,reject) => {
        const installLocation = process.argv[1]+config.srcScenario
        fs.readdir(installLocation,(err,files) => {
            if (err) reject(err)
            else {
                files.forEach(file => {
                    if (fs.statSync(`${installLocation}/${file}`).isFile()) {
                        fs.copy(`${installLocation}/${file}`,`${rootDir}/${file}`,{overwrite:process.env.useForce})
                        consoleLog('info','Copyed '+file)
                    }
                })
                resovle()
            }
        })
    }).catch(err => consoleLog('error',err))
}

async function skipPromt(submod,skip,noSkip,forceRecur) {
    if (submod.versionQurey.includes('?')) {
        // if this submodule is optional it will include ? in the version
        if (!skip.includes(submod.name) && !noSkip.includes(submod.name)) {
            // if it is not in any list then its depednices are also loaded, if accepted by user
            consoleLog('input',`"${submod.name}" is marked as optional would you like to install it?`)
            let userInput = process.env.skipUserInputValue
            if (!process.env.skipUserInput) userInput = await promptly.confirm('Would you like to install this module: (yes)',{default:'yes'})
            if (!userInput) skip.push(submod.name)
            else {
                noSkip.push(submod.name)
                await getSkips(submod,skip,noSkip)
            }
        }
    } else if (skip.includes(submod.name)) {
        // if the module is to be skiped but is required then it is removed from the skip list
        consoleLog('warning',`"${submod.name}" was marked to be skiped but is now required; modules will be installed.`)
        skip.splice(skip.indexOf(submod.name),1)
        noSkip.push(submod.name)
    } else if (forceRecur || !noSkip.includes(submod.name)) {
        // if it has not already been loaded then it will have its depedinces loaded
        if (!forceRecur) noSkip.push(submod.name)
        await getSkips(submod,skip,noSkip)
    } 
}

async function getSkips(softmod,skip,noSkip) {
    await softmod.updateFromJson()
    const subs = softmod.submodules
    subs.forEach(submod => noSkip.push(submod.name))
    for (let i = 0;i < subs.length;i++) await skipPromt(subs[i],skip,noSkip,true)
    const deps = softmod.dependencies
    for (let i = 0;i < deps.length;i++) await skipPromt(deps[i],skip,noSkip)
    if (softmod.collection && !noSkip.includes(softmod.collection.name)) await noSkip.push(softmod.collection.name)
    consoleLog('info','Checked dependencies for: '+softmod.name)
}

async function addSoftmodToIndex(softmod,index) {
    if (Object.keys(index).includes(softmod.name)) return
    await softmod.updateFromJson()
    if (softmod.installed) {
        consoleLog('info',`Added ${softmod.name} to the module index.`)
        index[softmod.name] = softmod
        await Promise.all(softmod.submodules.map(submod => addSoftmodToIndex(submod,index)))
    }
}

function generateIndex() {
    const index = {}
    return new Promise((resolve,reject) => {
        fs.readdir(rootDir+config.modulesDir,async (err,files) => {
            await Promise.all(files.map(file => {
                if (fs.statSync(`${rootDir+config.modulesDir}/${file}`).isDirectory()) {
                    const softmodJson = fs.readJSONSync(`${rootDir+config.modulesDir}/${file}/${config.jsonFile}`,{throws:false})
                    if (softmodJson) {
                        const softmod = Softmod.fromJson(softmodJson)
                        return addSoftmodToIndex(softmod,index)
                    }
                }
            }))
            // sortIndex takes the softmodName:softmod index and converts adds a _order key
            sortIndex(index)
            resolve(index)
        })
    }).catch(err => consoleLog('error',err))
}

function sortIndex(index) {
    const order = Object.keys(index)
    const deps = {}
    for (softmodName in index) {
        deps[softmodName] = index[softmodName].dependencies.map(value => value.name)
        index[softmodName].dependencies.forEach(dep => {
            dep = index[dep.name]
            if (dep && dep.submodules.length > 0) {
                dep.submodules.forEach(value => {
                    if (!deps[softmodName].includes(value.name)) deps[softmodName].push(value.name)
                })
            }
        })
        if (index[softmodName].parent) {
            const [parentName,parentVerseion] = Softmod.extractVersionFromName(index[softmodName].parent,true)
            deps[softmodName].push(parentName)
        }
    }
    function sort() {
        const subDone = []
        const changes = []
        for (softmodName in index) {
            if (!subDone.includes(softmodName)) {
                subDone.push(softmodName)
                const currentIndex = order.indexOf(softmodName)
                const depsIndex = deps[softmodName].map(dep => order.indexOf(dep))
                const max = Math.max(...depsIndex)
                if (max+1 > currentIndex) {
                    changes.push(softmodName)
                    order.splice(currentIndex,1)
                    order.splice(max+1,0,softmodName)
                }
            }
        }
        return changes
    }
    let ctn = 0
    let lastChange = ['first']
    let changes = []
    while (true) { // need a better way to run this loop
        ctn++
        consoleLog('info','Sorting index run: '+ctn)
        lastChange = changes
        changes = sort()
        if (ctn > 20) {
            consoleLog('warning','Max sort count reached (20); index may not be in order')
            break
        }
    }
    index._order = order
}

function saveIndex(index) {
    let output = ''
    index._order.forEach(softmodName => {
        const softmod = index[softmodName]
        output+=config.indexBody.replace('${module_name}',softmod.name).replace('${module_path}',`.${config.modulesDir}/${softmod.name.replace(/\./gi,'/')}`)
    })
    fs.writeFileSync(rootDir+config.modulesDir+config.modulesIndex,config.indexHeader+output+config.indexFooter)
    consoleLog('info','Saved index.lua')
}

function moveLocale() {
    return new Promise((resolve,reject) => {
        fs.readdir(rootDir+config.modulesDir,async (err,files) => {
            if (err) reject(err)
            else {
                await Promise.all(files.map(file => {
                    if (fs.statSync(`${rootDir+config.modulesDir}/${file}`).isDirectory()) {
                        consoleLog('info','Copyed '+file)
                        return new Softmod(file,'*').copyLocale()
                    }
                }))
                resolve()
            }
        })
    }).catch(err => consoleLog('error',err))
}

module.exports = async (softmod,cmd) => {
    process.env.keepZips = cmd.keepZips || ''
    try {
        if (cmd.dryRun) {
            // nothing will be downloaded
            consoleLog('status','Init of scenario files.')
            await initDir()
            consoleLog('status','Generating index file.')
            const index = await generateIndex()
            saveIndex(index)
            consoleLog('status','Post install locale copying (dry-run only)')
            moveLocale()
        } else {
            consoleLog('status','Init of scenario files.')
            await initDir()
            if (!process.env.useForce && softmod.installed) throw new Error('Softmod already installed')
            // generates a skip queue for optional modules
            consoleLog('status','Generating skip queue.')
            const skip = []
            const noSkip = [softmod.name]
            await getSkips(softmod,skip,noSkip)
            consoleLog('input','The following modules will be installed: ')
            console.log(noSkip.join(', '))
            let userInput = true
            if (!process.env.skipUserInput) userInput = await promptly.confirm('Would you like to continue the install: (yes)',{default:'yes'})
            if (!userInput) throw new Error('canceled')
            // starts the install of the first module
            consoleLog('status','Installing modules.')
            await softmod.install(true,skip)
            consoleLog('status','Generating index file.')
            await new Promise(resolve => setTimeout(resolve,10)) // bugs in the index generation with modules paths not existing
            const index = await generateIndex()
            saveIndex(index)
            if (!cmd.keepJsons) fs.remove(rootDir+config.jsonDir)
        }
        consoleLog('status','Command Finnished')
    } catch(err) {
        if (err.message != 'canceled') consoleLog('error',err)
    }
}