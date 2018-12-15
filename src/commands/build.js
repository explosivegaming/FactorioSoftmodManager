const fs = require('fs-extra')
const promptly = require('promptly')
const config = require('../config.json')
const archiver = require('archiver')

const Softmod = require('../lib/Softmod')
const {consoleLog,errorLog,finaliseLog} = require('../lib/consoleLog')
const LuaIndex = require('../lib/luaIndex')

const rootDir = process.env.dir

function getModules(dir) {
    const rtn = []
    return new Promise((resolve,reject) => {
        fs.readdir(dir,(err,files) => {
            if (err) reject(err)
            else {
                files.forEach(file => {
                    if (fs.existsSync(`${dir}/${file+config.jsonFile}`)) {
                        rtn.push(new Softmod(file))
                    }
                })
                resolve(rtn)
            }
        })
    }).catch(errorLog)
}

function getRawSubmodules(softmod) {
    if (softmod.isScenario) return []
    const rtn = []
    return new Promise((resolve,reject) => {
        fs.readdir(softmod.downloadPath,(err,files) => {
            if (err) reject(err)
            else {
                files.forEach(file => {
                    if (fs.existsSync(`${softmod.downloadPath}/${file+config.jsonFile}`)) {
                        rtn.push(new Softmod(`${softmod.name}.${file}`))
                    }
                })
                resolve(rtn)
            }
        })
    }).catch(errorLog)
}

async function getBuildTasks(softmod,tasks) {
    if (!tasks[softmod.name] && (softmod.installed || softmod.isScenario)) {
        await softmod.readJson(true)
        tasks[softmod.name] = softmod
        const subs = await getRawSubmodules(softmod)
        await Promise.all(subs.map(sub => getBuildTasks(sub,tasks))) 
    }
}

module.exports = async (softmod,cmd) => {
    try {
        const outputDir = typeof cmd.export == 'string' && cmd.export || '.'+config.outputDir
        const tasks = {}
        if (cmd.all) {
            const modules = await getModules(rootDir+config.modulesDir)
            if (fs.existsSync(`${rootDir}/${config.jsonFile}`)) modules.push(new Softmod('Scenario','*',true)) // checks for a scenario file
            await Promise.all(Object.values(modules).map(softmod => getBuildTasks(softmod,tasks)))
        } else await getBuildTasks(softmod,tasks)
        if (Object.keys(tasks).length == 0) throw new Error('Module is not insntalled')
        // user confirmation
        consoleLog('input','The following modules will be build: ')
        console.log(Object.keys(tasks).join(', '))
        let userInput = true
        if (!process.env.skipUserInput) userInput = await promptly.confirm('Would you like to continue the build: (yes)',{default:'yes'})
        if (!userInput) throw new Error('canceled')
        if (cmd.export) await fs.ensureDir(outputDir)
        // incremments the version numbers
        if (cmd.versionIncrement && !cmd.versionIncrementAll) {
            consoleLog('status','Incrementing version numbers')
            await softmod.incrementVeresion(cmd.versionIncrement == true ? 'patch' : cmd.versionIncrement,true,cmd.createBackup)
        } else if (cmd.versionIncrementAll) {
            consoleLog('status','Incrementing version numbers')
            await Promise.all(Object.values(tasks).map(task => task.incrementVeresion(cmd.versionIncrementAll == true ? 'patch' : cmd.versionIncrementAll,true,cmd.createBackup)))
        }
        // exports the json files
        consoleLog('status','Building module json files')
        await Promise.all(Object.values(tasks).map(async task => {
            await task.build(true,cmd.createBackup,true)
            if (cmd.export) {
                await fs.copy(task.downloadPath+config.jsonFile,`${outputDir}/${task.name}_${task.version}.json`)
                consoleLog('info','Exported json for: '+task.versionName)
            }
        }))
        // copies all local files
        consoleLog('status','Coyping locale files')
        await Promise.all(Object.values(tasks).map(async task => {
            await task.copyLocale()
        }))
        // builds a new index file
        consoleLog('status','Building new lus index')
        const index = new LuaIndex()
        await index.readDir(rootDir+config.modulesDir)
        await index.save(rootDir+config.modulesDir)
        if (cmd.export) await index.save(outputDir)
        // updates control.lua if needed
        // hanndels the different levels of verbose
        if (cmd.dev) {
            let dev = cmd.dev
            if (dev == true) dev = 4
            if (dev == 'none') dev = -1
            fs.readFile(rootDir+config.luaFile).then(data => {
                let newData = data.toString()
                if (dev >= 5) newData = newData.replace(/eventRegistered=(.+?),/g,'eventRegistered=true,')
                else newData = newData.replace(/eventRegistered=(.+?),/g,'eventRegistered=false,')
                if (dev >= 4) newData = newData.replace(/modulePost=(.+?),/g,'modulePost=true,')
                else newData = newData.replace(/modulePost=(.+?),/g,'modulePost=false,')
                if (dev >= 3) newData = newData.replace(/moduleInit=(.+?),/g,'moduleInit=true,')
                else newData = newData.replace(/moduleInit=(.+?),/g,'moduleInit=false,')
                if (dev >= 2) newData = newData.replace(/moduleLoad=(.+?),/g,'moduleLoad=true,')
                else newData = newData.replace(/moduleLoad=(.+?),/g,'moduleLoad=false,')
                if (dev >= 1) newData = newData.replace(/moduleEnv=(.+?),/g,'moduleEnv=true,')
                else newData = newData.replace(/moduleEnv=(.+?),/g,'moduleEnv=false,')
                if (dev >= 0) newData = newData.replace(/errorCaught=(.+?),/g,'errorCaught=true,')
                else newData = newData.replace(/errorCaught=(.+?),/g,'errorCaught=false,')
                fs.writeFile(rootDir+config.luaFile,newData)
            }).catch(reject)
        }
        // if no exporting then no point making zip files
        if (!cmd.export) {
            finaliseLog()
            return
        }
        consoleLog('status','Building module zip files')
        await Promise.all(Object.values(tasks).map(task => {
            if (task.isScenario) return
            consoleLog('start','Building zip for: '+task.versionName)
            return new Promise((resolve,reject) => {
                // formating events for the zip archive
                const output = fs.createWriteStream(`${outputDir}/${task.name}_${task.version}.zip`)
                const archive = archiver('zip')
                output.on('close',() => {
                    consoleLog('info',`Exported zip (${Math.ceil(archive.pointer()/1024)}KB) for: ${task.versionName}`)
                    resolve()
                })
                output.on('end',() => console.log('Data has been drained'))
                archive.on('warning',err => consoleLog('warning',err))
                archive.on('error',err => reject(err))
                archive.pipe(output)
                // adds files to the archive
                fs.readdir(task.downloadPath,(err,files) => {
                    if (err) reject(err)
                    else {
                        files.forEach(file => {
                            if (fs.statSync(`${task.downloadPath}/${file}`).isDirectory()) {
                                // the file is a directory; now tests that it is not a sub module
                                if (!fs.existsSync(`${task.downloadPath}/${file+config.jsonFile}`)) {
                                    consoleLog('info',`Added ${file} to: ${task.versionName}`)
                                    archive.directory(`${task.downloadPath}/${file}`,file)
                                }
                            } else {
                                consoleLog('info',`Added ${file} to: ${task.versionName}`)
                                archive.file(`${task.downloadPath}/${file}`,{name:file})
                            }
                        })
                        consoleLog('success','Built zip for: '+task.versionName)
                        archive.finalize()
                    }
                })
                // tells the archiver to finish and save
            }).catch(errorLog)
        }))
        finaliseLog()
    } catch (err) {
        if (err.message != 'canceled') consoleLog('error',err)
    }
}