// requires
const reader = require('./reader')
const Downloader = require('./downloader')
const Chalk = require('chalk')
const config = require('../config.json')
const fs = require('fs')

// may be a way to combine the online and offline functions
// offline is unable to read files due to the version being on the end
// creates a tree of depdnies so each module will be an array of its depedies, no downloading, relies on jsons inside module dirs
function treeDependenciesOffline(dir,tree={},moduleName,root=true) {
    // reads the modules dir
    return new Promise(async (resolve,reject) => {
        // module_path is not given when called by the user
        if (!moduleName) {
            // reads the module dir to find all modules
            fs.readdir(dir+config.modulesDir,async (err,files) => {
                if (err) reject(`Could not open module dir: ${err}`)
                else {
                    // loops over files in the module dir
                    for (i=0; i < files.length; i++) await treeDependenciesOffline(dir,tree,files[i])
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
                                tree[treeName][treeNameSub] = await treeDependenciesOffline(dir,tree,sub_module)
                            }
                        } break;
                        case 'Collection': {
                            // for a collection it will read all the submodules from they own file not from the included json
                            for (let sub_module in json.submodules) {
                                let sub_module_name = moduleName+'.'+sub_module
                                const treeNameSub = sub_module_name+'_'+json.submodules[sub_module].version
                                tree[treeName][treeNameSub] = await treeDependenciesOffline(dir,tree,sub_module_name)
                            }
                        } break;
                        case 'Submodule':
                        case 'Module': {
                            // every dependcy is loaded here
                            for (let dependency in json.dependencies) {
                                const treeNameSub = dependency+'_'+json.dependencies[dependency]
                                tree[treeName][treeNameSub] = await treeDependenciesOffline(dir,tree,dependency)
                            }
                        } break;
                    }
                    if (root) resolve(tree)
                    else resolve(tree[treeName])
                }
            }
            resolve(tree)
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
                        const version = file.substring(file.lastIndexOf('_')+1)
                        const name = file.substring(0,file.lastIndexOf('_'))
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
async function treeDependants(dir,moduleName,moduleVersion,offline) {
    // creates the tree
    const tree={}
    let DependenciesTree = {}
    if (offline) DependenciesTree = await treeDependenciesOffline(dir,{},moduleName,moduleVersion)
    else DependenciesTree = await treeDependencies(dir,{},moduleName,moduleVersion)
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
        if (newTree[moduleName]) return newTree[moduleName]
        else {
            // creats the new array for the module
            newTree[moduleName] = []
            for (let dependency in tree[moduleName]) {
                // inserts its dependencies (this could also be depentants)
                if (newTree[moduleName].indexOf(dependency) < 0) newTree[moduleName].push(dependency)
                // inserts the dependencies of its dependencies
                let sub = flattenTree(tree,newTree,dependency)
                for (i=0; i < sub.length;i++) {
                    // inserts if not already in the list
                    if (newTree[moduleName].indexOf(sub[i]) < 0 && moduleName != sub[i]) newTree[moduleName].push(sub[i])
                }
            }
            // returns only this module part for use of getting the sub_dependies
            return newTree[moduleName]
        }
    }
    // returns the full tree
    return newTree
}

// this resolves each member to a value based on a function, default is due set value to true if all of its dependents are true
function resolveTree(tree,newTree={},qurey) {
    const done = []
    if (!qurey) {qurey = (key,value) => {
        done.push(key)
        if (newTree[key]) return newTree[key]
        if (typeof value == 'boolean') return value
        let set = true
        let hasValues = false
        for (let subKey in value) {
            hasValues = true
            if (!newTree[subKey] && done.indexOf(subKey) < 0) {
                newTree[subKey] = qurey(subKey,tree[subKey])
                if (newTree[subKey] == false) set = false
            } else if (newTree[subKey] == false) set = false
        }
        if (hasValues) return set
        else return false
    }}
    for (let key in tree) newTree[key] = qurey(key,tree[key])
    return newTree
}

// gets the dependencies of this module and all of the dependencies of those dependencies
async function getDependencies(dir,moduleName,moduleVersion) {
    let tree = await treeDependencies(dir,{},moduleName,moduleVersion)
    tree = flattenTree(tree)
    return tree[moduleName+'_'+moduleVersion]
}

// same as getDependencies but only includes installed modules
// offline is unable to read files due to the version being on the end
async function getInstaledDependencies(dir,moduleName,moduleVersion) {
    let tree = await treeDependenciesOffline(dir,{},moduleName,moduleVersion)
    tree = flattenTree(tree)
    return tree[moduleName+'_'+moduleVersion]
}

// same as getDependencies but does not include optional dependencies
async function getRquiredDependencies(dir,moduleName,moduleVersion) {
    let tree = await treeDependencies(dir,{},moduleName,moduleVersion)
    tree = flattenTree(tree)
    return tree[moduleName+'_'+moduleVersion].filter(value => value.indexOf('?') < 0)
}

// gets the modules which are dependent of this module
async function getDependants(dir,moduleName,moduleVersion) {
    let tree = await treeDependants(dir,moduleName,moduleVersion)
    tree = flattenTree(tree)
    let rtn = []
    if (tree[moduleName+'_'+moduleVersion]) rtn = rtn.concat(tree[moduleName+'_'+moduleVersion])
    if (tree[moduleName+'_?'+moduleVersion]) rtn = rtn.concat(tree[moduleName+'_?'+moduleVersion])
    return rtn
}

// same as getDependants but only includes installed modules
// offline is unable to read files due to the version being on the end
async function getInstaledDependants(dir,moduleName,moduleVersion) {
    let tree = await treeDependants(dir,moduleName,moduleVersion,true)
    tree = flattenTree(tree)
    const rtn = []
    if (tree[moduleName+'_'+moduleVersion]) rtn.concat(tree[moduleName+'_'+moduleVersion])
    return rtn
}

// same as getDependencies but does not include optional dependencies
async function getRquiredDependants(dir,moduleName,moduleVersion) {
    let tree = await treeDependants(dir,moduleName,moduleVersion)
    tree = flattenTree(tree)
    const rtn = []
    if (tree[moduleName+'_'+moduleVersion]) rtn.concat(tree[moduleName+'_'+moduleVersion])
    return rtn
}

module.exports = {
    dependencies: treeDependencies,
    dependenciesOffline: treeDependenciesOffline,
    dependents: treeDependants,
    dependentsOffline: async (dir,moduleName,moduleVersion) => await treeDependants(dir,moduleName,moduleVersion,true),
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