const fs = require('fs')
const Chalk = require('chalk')
const zip = require('zip-folder')
const reader = require('../lib/reader')
const config = require('../config.json')
const update = require('./update')

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
            if (!files) console.log(Chalk.red('Could not read collection dir'))
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
            if (error) console.log(Chalk.red(error))
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
}