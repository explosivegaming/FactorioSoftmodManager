const fs = require('fs-extra')
const promptly = require('promptly')
const config = require('../config.json')
const archiver = require('archiver')

const Softmod = require('../lib/Softmod')
const consoleLog = require('../lib/consoleLog')

const rootDir = process.env.dir
/*
// copies the json file to the exports and updates the location url
function addJson(data,dest,moduleDir,module_name,moduleVersion,collection,baseURL) {
    return new Promise((resolve,reject) => {
        if (baseURL != undefined && data.type != 'Scenario') data.location = baseURL+'/'+module_name+'_'+moduleVersion+'.zip'
        if (collection) data.collection = collection
        if (!fs.existsSync(dest+'/jsons')) fs.mkdirSync(dest+'/jsons')
        fs.writeFile(dest+'/jsons/'+module_name+'_'+moduleVersion+'.json',JSON.stringify(data,undefined,4),(error) => {if (!error) console.log(`Exported ${module_name}_${data.version}.json`)})
        fs.writeFile(moduleDir+config.jsonFile,JSON.stringify(data,undefined,4),error => {if (error) {reject(error)} else {resolve()}})
    })
}

// zips a module into the exports and if it is a collection it will also add the submodules 
async function addModule(exportsDir,moduleDir,module_name,baseURL) {
    const data = reader.json(moduleDir)
    if (data) {
        let collection
        if (module_name) {collection = module_name+'_'+data.version;module_name = module_name+'.'+data.name}
        else module_name = data.name
        await update(moduleDir)
        await addJson(data,exportsDir,moduleDir,module_name,data.version,collection,baseURL)
        if (data.type == 'Collection') {
            const files = fs.readdirSync(moduleDir)
            if (!files) console.log(chalk.red('Could not read collection dir'))
            else {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i]
                    if (fs.statSync(moduleDir+'/'+file).isDirectory()) {
                        await addModule(exportsDir,moduleDir+'/'+file,module_name,baseURL)
                    }
                }
                // a collection will require a second update
                await update(moduleDir)
            }
        }
        if (data.type != 'Scenario') {
            zip(moduleDir,exportsDir+'/'+module_name+'_'+data.version+'.zip',(error) => {if(!error) console.log(`Exported ${module_name}_${data.version}.zip`)})
        }
    }
}

module.exports = (options) => {
    const dir = process.env.dir
    if (fs.existsSync(dir+config.modulesDir)) {
        if (!fs.existsSync(dir+'/exports')) fs.mkdirSync(dir+'/exports')
        fs.readdir(dir+config.modulesDir,(error,files) => {
            if (error) console.log(chalk.red(error))
            else {
                files.forEach(async file => {
                    if (fs.statSync(dir+config.modulesDir+'/'+file).isDirectory()) {
                        await addModule(dir+'/exports',dir+config.modulesDir+'/'+file,undefined,options.url)
                    }
                })
            }
        })
    } else {
        let exportDir = dir
        if (dir.indexOf(config.modulesDir) > 0) exportDir = dir.substring(0,dir.indexOf(config.modulesDir))
        if (!fs.existsSync(exportDir+'/exports')) fs.mkdirSync(exportDir+'/exports')
        addModule(exportDir+'/exports',dir,undefined,options.url)
    }
}*/

function getRawSubmodules(softmod) {
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
    }).catch(err => consoleLog('error',err))
}

async function getBuildTasks(softmod,tasks={}) {
    if (!tasks[softmod.name] && softmod.installed) {
        tasks[softmod.name] = softmod
        await softmod.readJson(true)
        const subs = await getRawSubmodules(softmod)
        await Promise.all(subs.map(sub => getBuildTasks(sub,tasks))) 
    }
    return tasks
}

module.exports = async (softmod,cmd) => {
    try {
        const outputDir = cmd.outputDir || '.'+config.outputDir
        const tasks = await getBuildTasks(softmod)
        // user confirmation
        consoleLog('input','The following modules will be build: ')
        console.log(Object.keys(tasks).join(', '))
        let userInput = true
        if (!process.env.skipUserInput) userInput = await promptly.confirm('Would you like to continue the install: (yes)',{default:'yes'})
        if (!userInput) throw new Error('canceled')
        await fs.ensureDir(outputDir)
        // exports the json files
        consoleLog('status','Building module json files')
        await Promise.all(Object.values(tasks).map(async task => {
            await task.build(true,cmd.createBackup)
            await fs.copy(task.downloadPath+config.jsonFile,`${outputDir}/${task.name}_${task.version}.json`)
            consoleLog('info','Exported json for: '+task.versionName)
        }))
        consoleLog('status','Building module json files')
        await Promise.all(Object.values(tasks).map(async task => {
            await task.build(true,cmd.createBackup)
            await fs.copy(task.downloadPath+config.jsonFile,`${outputDir}/${task.name}_${task.version}.json`)
            consoleLog('info','Exported json for: '+task.versionName)
        }))
        consoleLog('status','Building module zip files')
        await Promise.all(Object.values(tasks).map(task => {
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
            }).catch(err => consoleLog('error',err))
        }))
        consoleLog('status','Command Finnished')
    } catch (err) {
        if (err.message != 'canceled') consoleLog('error',err)
    }
}