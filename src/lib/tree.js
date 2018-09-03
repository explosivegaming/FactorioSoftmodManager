// requires
const reader = require('./reader')
const Downloader = require('./downloader')
const Version = require('./version')
const Chalk = require('chalk')
const config = require('../config.json')
const fs = require('fs')

// may be a way to combine the online and offline functions
// offline is unable to read files due to the version being on the end
// creates a tree of depdnies so each module will be an array of its depedies, no downloading, relies on jsons inside module dirs
function treeDependenciesOffline(dir,tree={},moduleName,moduleVersion,root=true) {
    // reads the modules dir
    return new Promise(async (resolve,reject) => {
        // module_path is not given when called by the user
        if (!moduleName) {
            // reads the module dir to find all modules
            fs.readdir(dir+config.modulesDir,async (err,files) => {
                if (err) reject(`Could not open module dir: ${err}`)
                else {
                    // loops over files in the module dir
                    for (i=0; i < files.length; i++) await treeDependenciesOffline(dir,tree,files[i],moduleVersion,false)
                }
                // returns the whole tree
                resolve(tree)
            })
        } else {
            const module_paths = reader.path(dir,moduleName)
            for (let i = 0; i < module_paths.length; i++) {
                let module_path = module_paths[i]
                if (fs.statSync(module_path).isDirectory()) {
                    // if it is a dir then it will try to read the json file
                    const json = reader.json(module_path)
                    // catches errors while reading the module
                    if (!json) throw new Error('Could not read json for: '+module_path)
                    if (moduleName.lastIndexOf('_') > 0) moduleName = moduleName.substring(0,moduleName.lastIndexOf('_'))
                    const treeName = moduleName+'_'+json.version
                    // modules and submodules will insert values into their list rather than load more modules
                    if (tree[treeName]) {resolve(tree[treeName]);return}
                    tree[treeName] = {}
                    switch (json.type) {
                        case 'Scenario': {
                            // if it is a scenario then it will read all the modules in the scenario
                            for (let sub_module in json.modules) {
                                const treeNameSub = sub_module+'_'+json.modules[sub_module]
                                tree[treeName][treeNameSub] = await treeDependenciesOffline(dir,tree,sub_module,moduleVersion,false)
                            }
                        } break;
                        case 'Collection': {
                            // for a collection it will read all the submodules from they own file not from the included json
                            for (let sub_module in json.submodules) {
                                let sub_module_name = moduleName+'.'+sub_module
                                const treeNameSub = sub_module_name+'_'+json.submodules[sub_module].version
                                tree[treeName][treeNameSub] = await treeDependenciesOffline(dir,tree,sub_module_name,moduleVersion,false)
                            }
                        } break;
                        case 'Submodule':
                        case 'Module': {
                            // every dependcy is loaded here
                            for (let dependency in json.dependencies) {
                                const treeNameSub = dependency+'_'+json.dependencies[dependency]
                                tree[treeName][treeNameSub] = await treeDependenciesOffline(dir,tree,dependency,moduleVersion,false)
                            }
                        } break;
                    }
                    if (root) resolve(tree)
                    else resolve(tree[treeName])
                }
            }
            resolve(false)
        }
    }).catch(err => console.log(Chalk.red(err)))
}

// creates a tree of depdnies so each module will be an array of its depedies
function treeDependencies(dir,tree={},moduleName,moduleVersion,root=true) {
    // reads the modules dir
    return new Promise(async (resolve,reject) => {
        // if no module name then it will create one for all modules
        if (!moduleName) {
            // reads the module dir to find all modules installed modules
            fs.readdir(dir+config.modulesDir,async (err,files) => {
                if (err) reject(`Could not open module dir: ${err}`)
                else {
                    // loops over files in the module dir
                    for (i=0; i < files.length; i++) {
                        let file = files[i]
                        const [name,version] = Version.extract(file,true)
                        // runs this function again for each module
                        if (fs.statSync(dir+config.modulesDir+'/'+file).isDirectory()) await treeDependencies(dir,tree,name,version,false)
                    }
                }
                // returns the whole tree
                resolve(tree)
            })
        } else {
            // if it is a dir then it will try to read the json file
            const json = await Downloader.getJson(dir,moduleName,moduleVersion)
            const treeName = moduleName+'_'+json.version
            // catches errors while reading the module
            if (!json) throw new Error('Could not read json for: '+treeName)
            // modules and submodules will insert values into their list rather than load more modules
            if (tree[treeName]) {resolve(tree[treeName]); return}
            tree[treeName] = {}
            switch (json.type) {
                case 'Scenario': {
                    // if it is a scenario then it will read all the modules in the scenario
                    for (let sub_module in json.modules) {
                        const treeNameSub = sub_module+'_'+json.modules[sub_module]
                        tree[treeName][treeNameSub] = await treeDependencies(dir,tree,sub_module,json.modules[sub_module],false) 
                    }
                } break;
                case 'Collection': {
                    // for a collection it will read all the submodules from they own file not from the included json
                    for (let sub_module in json.submodules) {
                        let sub_module_name = moduleName+'.'+sub_module
                        const treeNameSub = sub_module_name+'_'+json.submodules[sub_module].version
                        tree[treeName][treeNameSub] = await treeDependencies(dir,tree,sub_module_name,json.submodules[sub_module].version,false)
                    }
                } break;
                case 'Submodule':
                case 'Module': {
                    // every dependcy is loaded here
                    for (let dependency in json.dependencies) {
                        const treeNameSub = dependency+'_'+json.dependencies[dependency]
                        tree[treeName][treeNameSub] = await treeDependencies(dir,tree,dependency,json.dependencies[dependency],false)
                    }
                } break;
            }
            if (root) resolve(tree)
            else resolve(tree[treeName])
        }
    }).catch(err => console.log(Chalk.red(err)))
}

// creates a tree of depdnies so each module will have the modules which it dependes on under its name
// why is this so much simplier than the one above >_<
async function treeDependants(dir,tree={},moduleName,moduleVersion,offline) {
    // creates the tree
    let DependenciesTree = {}
    if (offline) DependenciesTree = await treeDependenciesOffline(dir,{})
    else DependenciesTree = await treeDependencies(dir,{})
    // loops over every module
    for (let mod in DependenciesTree) {
        let moduleDependencies = DependenciesTree[mod]
        // loops over each dependency
        for (let dependency in moduleDependencies) {
            // inverts the list for the depentants
            if (!tree[dependency]) tree[dependency] = {}
            if (!tree[mod]) tree[mod] = {}
            tree[dependency][mod] = tree[mod]
        }
    }
    return tree
}

// this converts the tree to not require multiple indexing
// does not quite qork due to version diffrences
function flattenTree(tree,newTree={},moduleName) {
    if (!moduleName) {
        // no module name when called by user
        for (let mod in tree) {
            // loops over every module and flatterns it
            flattenTree(tree,newTree,mod)
        }
    } else {
        // if it is already flaterned then it is not done again
        const [moduleNameRaw, moduleVersion] = Version.extract(moduleName,true)
        const possibleVersions = Object.keys(tree).filter(value => value.includes(moduleNameRaw)).map(value => Version.extract(value))
        const foundVersion = Version.match(possibleVersions,moduleVersion,true)
        const foundModuleName = moduleNameRaw+'_'+foundVersion
        if (newTree[moduleName]) return newTree[moduleName]
        else if (foundModuleName != moduleName && newTree[foundModuleName]) {
            newTree[moduleName] = newTree[foundModuleName]
            return newTree[moduleName]
        } else if (foundModuleName != moduleName && tree[foundModuleName]) {
            newTree[moduleName] = flattenTree(tree,newTree,foundModuleName)
            return newTree[moduleName]
        }
        // creats the new array for the module
        newTree[moduleName] = []
        for (let dependency in tree[moduleName]) {
            // inserts its dependencies (this could also be depentants)
            if (newTree[moduleName].indexOf(dependency) < 0) newTree[moduleName].push(dependency)
            // inserts the dependencies of its dependencies
            let sub = flattenTree(tree,newTree,dependency)
            for (i=0; i < sub.length;i++) {
                // inserts if not already in the list
                if (!newTree[moduleName].includes(sub[i]) && moduleName != sub[i]) newTree[moduleName].push(sub[i])
            }
        }
        // returns only this module part for use of getting the sub_dependies
        return newTree[moduleName]
    }
    // returns the full tree
    return newTree
}

// this resolves each member to a value based on a function, default is due set value to true if all of its dependents are true
function resolveTree(tree,newTree={},qurey) {
    const done = []
    if (!qurey) {qurey = (key,value,recur) => {
        done.push(key)
        if (newTree[key]) return newTree[key]
        if (typeof value == 'boolean') return value
        let set = true
        let hasValues = false
        for (let subKey in value) {
            hasValues = true
            if (!newTree[subKey] && done.indexOf(subKey) < 0) {
                newTree[subKey] = recur(subKey,tree[subKey],recur)
                if (newTree[subKey] == false) set = false
            } else if (newTree[subKey] == false) set = false
        }
        if (hasValues) return set
        else return false
    }}
    for (let key in tree) newTree[key] = qurey(key,tree[key],qurey)
    return newTree
}

// used to avoid alot of repation in the following functions
async function treeHelper(dir,moduleName,moduleVersion,callback,extra) {
    let tree = await callback(dir,{},moduleName,moduleVersion,extra)
    tree = flattenTree(tree)
    const versions = Object.keys(tree).map(value => Version.extract(value,true)).filter(value => moduleName == value[0]).map(value => value[1])
    moduleVersion = Version.match(versions,moduleVersion,true).match(/\d\.\d\.\d/)[0]
    return [moduleVersion,tree]
}

// gets the dependencies of this module and all of the dependencies of those dependencies
async function getDependencies(dir,moduleName,moduleVersion) {
    const [moduleVersionMatched,tree] = await treeHelper(dir,moduleName,moduleVersion,treeDependencies)
    return tree[moduleName+'_'+moduleVersionMatched]
}

// same as getDependencies but only includes installed modules
async function getInstaledDependencies(dir,moduleName,moduleVersion) {
    const [moduleVersionMatched,tree] = await treeHelper(dir,moduleName,moduleVersion,treeDependenciesOffline)
    return tree[moduleName+'_'+moduleVersionMatched]
}

// same as getDependencies but does not include optional dependencies
async function getRquiredDependencies(dir,moduleName,moduleVersion) {
    const [moduleVersionMatched,tree] = await treeHelper(dir,moduleName,moduleVersion,treeDependencies)
    return tree[moduleName+'_'+moduleVersionMatched].filter(value => value.indexOf('?') < 0)
}

// gets the modules which are dependent of this module
async function getDependants(dir,moduleName,moduleVersion) {
    const [moduleVersionMatched,tree] = await treeHelper(dir,moduleName,moduleVersion,treeDependants)
    const versions = Object.keys(tree).map(value => Version.extract(value,true)).filter(value => moduleName == value[0]).map(value => value[1])
    let rtn = []
    versions.forEach(version => {
        if (Version.match([moduleVersionMatched],version)) rtn = rtn.concat(tree[moduleName+'_'+version])
    })
    return rtn
}

// same as getDependants but only includes installed modules
async function getInstaledDependants(dir,moduleName,moduleVersion) {
    const [moduleVersionMatched,tree] = await treeHelper(dir,moduleName,moduleVersion,treeDependants,true)
    const versions = Object.keys(tree).map(value => Version.extract(value,true)).filter(value => moduleName == value[0]).map(value => value[1])
    let rtn = []
    versions.forEach(version => {
        if (version.indexOf('?') < 0 && Version.match([moduleVersionMatched],version)) rtn = rtn.concat(tree[moduleName+'_'+version])
    })
    return rtn
}

// same as getDependencies but does not include optional dependencies
async function getRquiredDependants(dir,moduleName,moduleVersion) {
    const [moduleVersionMatched,tree] = await treeHelper(dir,moduleName,moduleVersion,treeDependants)
    const versions = Object.keys(tree).map(value => Version.extract(value,true)).filter(value => moduleName == value[0]).map(value => value[1])
    let rtn = []
    versions.forEach(version => {
        if (version.indexOf('?') < 0 && Version.match([moduleVersionMatched],version)) rtn = rtn.concat(tree[moduleName+'_'+version])
    })
    return rtn
}

module.exports = {
    dependencies: treeDependencies,
    dependenciesOffline: treeDependenciesOffline,
    dependents: treeDependants,
    dependentsOffline: async (dir,moduleName,moduleVersion) => await treeDependants(dir,{},moduleName,moduleVersion,true),
    flatten: flattenTree,
    resolve: resolveTree,
    module: {
        dependencies: getDependencies,
        dependenciesInstalled: getInstaledDependencies,
        dependenciesRequired: getRquiredDependencies,
        dependents: getDependants,
        dependentsInstalled: getInstaledDependants,
        dependentsRequired: getRquiredDependants
    }
}