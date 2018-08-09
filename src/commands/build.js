const fs = require('fs')
const Chalk = require('chalk')
const zip = require('zip-folder')
const reader = require('../lib/reader')
const config = require('../config.json')
const update = require('./update')

// copies the json file to the exports and updates the location url
function addJson(data,dest,moduleDir,module_name,baseURL) {
    if (baseURL != undefined && data.type != 'Scenario') data.location = baseURL+'/'+module_name+'.zip'
    if (!fs.existsSync(dest+'/jsons')) fs.mkdirSync(dest+'/jsons')
    fs.writeFile(dest+'/jsons/'+module_name+'.json',JSON.stringify(data,undefined,4),(error) => {if (!error) console.log(`Exported ${module_name}.json`)})
    fs.writeFileSync(moduleDir+config.jsonFile,JSON.stringify(data,undefined,4))
}

// zips a module into the exports and if it is a collection it will also add the submodules 
async function addModule(exportsDir,moduleDir,module_name,baseURL) {
    const data = reader.json(moduleDir)
    if (data) {
        if (module_name) module_name = module_name+'.'+data.name
        else module_name = data.name
        addJson(data,exportsDir,moduleDir,module_name,baseURL)
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
            }
        }
        await update(moduleDir)
        if (data.type != 'Scenario') {
            zip(moduleDir,exportsDir+'/'+module_name+'.zip',(error) => {if(!error) console.log(`Exported ${module_name}.zip`)})
        }
    }
}

module.exports = (dir='.',options) => {
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