const fs = require('fs')
const Chalk = require('chalk')
const unzip = require('unzip')
const config = require('../config.json')
const valid = require('../lib/valid')
const Request = require('request')
const request = Request.defaults({baseUrl:config.serverURL})

// downloads a json file that will then be saved and then used
function downloadJson(dir,moduleName,moduleVersion) {
    return new Promise((resolve,reject) => {
        request.get(`/package/${moduleName}?version=${moduleVersion}`,{json:true},(error, response, body) => {
            // handlers errors from the server
            if (error || (typeof body == 'string' && body.includes('Error'))) {
                const err = typeof body == 'string' && body || error
                reject(err); return
            }
            const json = body.json
            const latest = body.latest
            let isValid = false
            // depending on what type of module it is then it will require different validation
            switch (json.type) {
                case undefined: break
                default: break
                case 'Submodule': if (valid.submodule(json)) isValid = true; break
                case 'Module': if (valid.module(json)) isValid = true; break
                case 'Scenario': if (valid.secnario(json)) isValid = true; break
                case 'Collection': if (valid.collection(json)) isValid = true; break
            }
            if (isValid) {
                // if it was a valid lookup its json is saved for later use
                if (!fs.existsSync(dir+config.jsonDir) || !fs.statSync(dir+config.jsonDir).isDirectory()) fs.mkdirSync(dir+config.jsonDir)
                fs.writeFile(`${dir}${config.jsonDir}/${moduleName}-${latest}.json`,JSON.stringify(json,undefined,4),() => {})
            } else reject(`Json file was invalid`)
            resolve(body)
        })
    }).catch(err => console.log(Chalk.red(err)))
}

// will get the json file for a module or download it if it is not already
async function getJson(dir,moduleName,moduleVersion) {
    return new Promise((resolve,reject) => {
        fs.readFile(`${dir}${config.jsonDir}/${moduleName}-${moduleVersion}.json`,async (error, file) => {
            if (!error && file) resolve(JSON.parse(file))
            const rawDownload = await downloadJson(dir,moduleName,moduleVersion)
            resolve(rawDownload.json)
        })
    }).catch(err => console.log(Chalk.red(err)))
}

// downloads and unzips the module into the module dir, also copies the chached json to the folder
function downloadModule(dir,moduleName,moduleVersion) {
    return new Promise(async (resolve,reject) => {
        // extracts information from the name to be used for the path of the json
        const json = await getJson(dir,moduleName,moduleVersion)
        const url = json.location
        const version = json.version
        let dirName = false
        let path = json.name+'-'+version
        let parent = json.collection
        while (parent) {
            let pJson = await getJson(dir,parent.substring(0,parent.lastIndexOf('-')),parent.substring(parent.lastIndexOf('-')+1))
            if (!pJson) break
            path = pJson.name+'-'+pJson.version+'/'+path
            if (!dirName) dirName = pJson.name+'-'+pJson.version
            if (pJson.collection) {parent = pJson.collection} else parent = false
        }
        path = dir+config.modulesDir+'/'+path
        // need a better check for valid urls, "url" was just a place holder while making the jsons
        if (url == 'url') {reject('Invalid Url');return}
        if (fs.existsSync(path)) {reject('Already Installed: '+moduleName+'-'+moduleVersion);return}
        console.log(Chalk`  Downloading ${moduleName}-${version}: {grey ${url}}`)
        // starts the download and extraction
        Request(url).pipe(unzip.Extract({path:path})).on('close',() => {
            // once it is downloaded and extracted the module json is copyed from the chache
            if (fs.existsSync(dir+config.jsonDir+'/'+moduleName+'-'+version+'.json')) {
                fs.copyFileSync(dir+config.jsonDir+'/'+moduleName+'-'+version+'.json',path+'/softmod.json')
            }
            // it will also look for a collection json and copy that also
            if (fs.existsSync(dir+config.jsonDir+'/'+dirName+'.json')) {
                fs.copyFileSync(dir+config.jsonDir+'/'+dirName+'.json',path+'/../softmod.json')
            }
            resolve()
        })
    }).catch(err => console.log(Chalk.red(err)))
}

module.exports = {
    getJson:getJson,
    getModule:downloadModule,
    downloadJson:downloadJson
}