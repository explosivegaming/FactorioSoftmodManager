// requires
const reader = require('./reader')
const Chalk = require('chalk')
const config = require('../config.json')
const fs = require('fs')

// creates a tree of depdnies so each module will be an array of its depedies
function treeDependencies(dir,tree={},module_path,mod_name) {
    // reads the modules dir
    return new Promise(async (resolve,reject) => {
        // module_path is not given when called by the user
        if (!module_path) {
            // reads the module dir to find all modules
            fs.readdir(dir+config.modulesDir,async (err,files) => {
                if (err) reject(`Could not open module dir: ${err}`)
                else {
                    // loops over files in the module dir
                    for (i=0; i < files.length; i++) {
                        let file = files[i]
                        // runs this function again for each module
                        await treeDependencies(dir,tree,dir+config.modulesDir+'/'+file)
                    }
                }
                // returns the whole tree
                resolve(tree)
            })
        } else {
            if (fs.statSync(module_path).isDirectory()) {
                // if it is a dir then it will try to read the json file
                const mod = reader.json(module_path)
                // catches errors while reading the module
                if (!mod) throw new Error('Could not read json for: '+module_path)
                if (!mod_name) mod_name = mod.name
                switch (mod.type) {
                    case 'Scenario': {
                        // if it is a scenario then it will read all the modules in the scenario
                        for (i=0; i < mod.modules.length; i++) {
                            let sub_module = mod.modules[i]
                            // provents dobble reading
                            if (!tree[sub_module]) {
                                tree[sub_module] = {}
                                await treeDependencies(dir,tree,dir+config.modulesDir+sub_module.replace('.','/'))
                            }
                        }
                    } break;
                    case 'Collection': {
                        // for a collection it will read all the submodules from they own file not from the included json
                        for (let sub_module in mod.submodules) {
                            let sub_module_name = mod_name+'.'+sub_module
                            // provents dobble reading
                            if (!tree[sub_module_name]) {
                                tree[sub_module_name] = {}
                                await treeDependencies(dir,tree,module_path+'/'+sub_module,sub_module_name)
                            }
                        }
                    } break;
                    case 'Submodule':
                    case 'Module': {
                        // modules and submodules will insert values into their list rather than load more modules
                        if (!tree[mod_name]) tree[mod_name] = {}
                        // every dependcy is loaded here
                        for (let dependency in mod.dependencies) {
                            // provents dobble reading
                            if (!tree[dependency]) {
                                tree[dependency] = {}
                                await treeDependencies(dir,tree,dir+config.modulesDir+'/'+dependency.replace('.','/'),dependency)
                            }
                            // creates a link to the top of the stack
                            tree[mod_name][dependency] = tree[dependency]
                        }
                    } break;
                }
            }
            resolve(tree)
        }
    }).catch(err => console.log(Chalk.red(err)))
}

// creates a tree of depdnies so each module will have the modules which it dependes on under its name
// why is this so much simplier than the one above >_<
async function treeDependants(dir) {
    // creates the tree
    const tree={}
    const DependenciesTree = await treeDependencies(dir)
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
function flattenTree(tree,newTree={},module_name) {
    if (!module_name) {
        // no module name when called by user
        for (let mod in tree) {
            // loops over every module and flatterns it
            flattenTree(tree,newTree,mod)
        }
    } else {
        // if it is already flaterned then it is not done again
        if (newTree[module_name]) return newTree[module_name]
        else {
            // creats the new array for the module
            newTree[module_name] = []
            for (let dependency in tree[module_name]) {
                // inserts its dependencies (this could also be depentants)
                if (newTree[module_name].indexOf(dependency) < 0) newTree[module_name].push(dependency)
                // inserts the dependencies of its dependencies
                let sub = flattenTree(tree,newTree,dependency)
                for (i=0; i < sub.length;i++) {
                    // inserts if not already in the list
                    if (newTree[module_name].indexOf(sub[i]) < 0 && module_name != sub[i]) newTree[module_name].push(sub[i])
                }
            }
            // returns only this module part for use of getting the sub-dependies
            return newTree[module_name]
        }
    }
    // returns the full tree
    return newTree
}

// this resolves each member to a value based on a function, default is due set value to true if all of its dependents are true
function resolveTree(tree,qurey) {
    
}

// gets the dependencies of this module and all of the dependencies of those dependencies
function getDependencies(moduleName) {
    
}

// same as getDependencies but only includes installed modules
function getInstaledDependencies(moduleName) {
    
}

// same as getDependencies but does not include optional dependencies
function getRquiredDependencies(moduleName) {
    
}

// gets the modules which are dependent of this module
function getDependants(moduleName) {
    
}

// same as getDependants but only includes installed modules
function getInstaledDependants(moduleName) {
    
}

// same as getDependencies but does not include optional dependencies
function getRquiredDependants(moduleName) {
    
}

module.exports = {
    dependencies: treeDependencies,
    dependents: treeDependants,
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