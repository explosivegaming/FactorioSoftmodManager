// require 
const promptly = require('promptly')
const fs = require('fs')
const valid = require('./../lib/valid')
const config = require('./../config.json')

// will read the json of the module, if one is present, and return the current value
function read_default(dir,key) {
    try {
        const file = dir+config.jsonFile
        const data = JSON.parse(fs.readFileSync(file,'utf8'))
        return data[key] || undefined
    } catch(error) {
        return undefined
    }
}

// a helper function to handle the default values and user io
async function get_input(dir,data,data_key,options,options_key,name,default_value) {
    // default is set via cli or the current value or the default passed to the function
    let default_input = options[options_key] || read_default(dir,data_key) || default_value
    if (typeof default_input === 'object') default_input=Object.values(default_input).join(',')
    // if the value was not set via cli and the yes flag was not set then it will ask for user input, else use default
    if (!options[options_key] && !options.yesAll) {
        data[data_key] = await promptly.prompt(`Module ${name}: (${default_input}) `,{trim:false,default:default_input})
    } else data[data_key]=default_input
}

// all json files will include this information
async function basic(dir,data,options) {
    const path = fs.realpathSync(dir)
    // gets the dir name of the module to be used as the default name
    const dir_name = path.lastIndexOf('/') > 0 && path.substring(path.lastIndexOf('/')+1) || path.lastIndexOf('\\') > 0 && path.substring(path.lastIndexOf('\\')+1) || undefined
    await get_input(dir,data,'name',options,'moduleName','name',dir_name)
    await get_input(dir,data,'version',options,'moduleVersion','version','1.0.0')
    await get_input(dir,data,'module',options,'module','type','Scenario')
    await get_input(dir,data,'description',options,undefined,'description','<blank>')
}

// all other jsons will have this extra infomation
async function detail(dir,data,options) {
    await get_input(dir,data,'location',options,'url','location url','<blank>')
    await get_input(dir,data,'keywords',options,'keyWords','keywords','<blank>')
    // spilts the keywords using ,
    data.keywords = data.keywords.split(',')
    await get_input(dir,data,'author',options,'author','author','<blank>')
    await get_input(dir,data,'contact',options,'contact','contact','<blank>')
    await get_input(dir,data,'license',options,'license','license','<blank>')
}

function addCollectionToScenario(dir,modules,collection_name,collection_version,collection_modules) {
    const submodules = fs.readdirSync(dir)
    let all = true
    for (let module_name in collection_modules) {
        if (!submodules.includes(module_name)) {all = false;break}
    }
    if (all) {
        modules[collection_name] = `^${collection_version}`
    } else {
        submodules.forEach(sub_dir_name => {
            // loops over each submodule
            if (fs.statSync(`${dir}/${sub_dir_name}`).isDirectory()) {
                // does the same thing as if it were a module
                const name = read_default(`${dir}/${sub_dir_name}`,'name')
                const version = read_default(`${dir}/${sub_dir_name}`,'version')
                const module_type = read_default(`${dir}/${sub_dir_name}`,'module')
                if (version && module_type == 'Collection') { 
                    // if it has a version and it is a collection then add the installed submodules not the full collection
                    addCollectionToScenario(`${module_dir}/${dir_name}`,modules,name,version,read_default(`${dir}/${sub_dir_name}`,'submodules'))
                } else if (version) {
                    // if it has a name and version it if added to the json
                    modules[collection_name+'.'+name] = `^${version}`
                }
            }
        })
    }
}

module.exports = async (dir='.',options) => {
    try {
        const data = {}
        // basic is ran for all json file types
        await basic(dir,data,options)
        switch (data.module) {
            case 'Scenario': {
                // for scenarios the module dir will be read and auto appented to the json
                data.modules = read_default(dir,'modules') || {}
                const module_dir = dir+config.modulesDir
                const files = fs.readdirSync(module_dir)
                if (!files) {console.log('Skiping module loading, modules dir not found'); break}
                // loops over the files in the module dir
                files.forEach(dir_name => {
                    if (fs.statSync(`${module_dir}/${dir_name}`).isDirectory()) {
                        // if it is a dir then it will try to read the json file and retreive a name
                        const name = read_default(`${module_dir}/${dir_name}`,'name')
                        if (name) {
                            const version = read_default(`${module_dir}/${dir_name}`,'version')
                            const module_type = read_default(`${module_dir}/${dir_name}`,'module')
                            if (version && module_type == 'Collection') { 
                                // if it has a version and it is a collection then add the installed submodules not the full collection
                                addCollectionToScenario(`${module_dir}/${dir_name}`,data.modules,name,version,read_default(`${module_dir}/${dir_name}`,'submodules'))
                            } else if (version) {
                                // if it has a name and version it if added to the json
                                data.modules[name] = `^${version}`
                            }
                        }
                    }
                })
            } break
            case 'Collection': {
                // if it is a collection it will get extra info and look in the current dir for modules
                await detail(dir,data,options)
                data.submodules = read_default(dir,'submodules') || {}
                const files = fs.readdirSync(dir)
                if (!files) {console.log('Skiping module loading, modules dir not found'); break}
                // loops over files in the current dir
                files.forEach(dir_name => {
                    if (fs.statSync(`${dir}/${dir_name}`).isDirectory()) {
                        // if it is a dir then it will try to read the json file and retreive a name
                        const name = read_default(`${dir}/${dir_name}`,'name')
                        if (name) {
                            // if it is a valid submodule it is added to the json
                            const module_data = JSON.parse(fs.readFileSync(`${dir}/${dir_name}${config.jsonFile}`))
                            if (valid.submodule(module_data)) data.submodules[name] = module_data
                        }
                    }
                })
                // will loop over already existing submodules to cheak that all are valid
                if (config.cleanModules) for (let submodule_name in data.submodules) if (!valid.submodule(data.submodules[submodule_name])) delete data.submodules[submodule_name]
            } break
            default: {
                // modules just get extra detail no extra auto append
                await detail(dir,data,options)
            }
        }
        // the json file is then writen into the dir
        fs.writeFile(dir+config.jsonFile,JSON.stringify(data,undefined,4),err => {
            if (err) console.log(`Error writing file: ${err}`) 
            else console.log(`Wrote file: ${fs.realpathSync(dir+config.jsonFile)}`)
        })
    } catch(error) {
        // logs all errors but ^C
        if (error.message != 'canceled') console.log(Chalk.red(error))
    }
}