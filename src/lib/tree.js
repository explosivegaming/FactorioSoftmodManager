// requires
const valid = require('./valid')
const Chalk = require('chalk')
const config = require('../config.json')
const fs = require('fs')

// creates a tree of depdnies so each module will have its dependies in the table under its name
function treeDependies() {

}

// creates a tree of depdnies so each module will have the modules which it dependes on under its name
function treeDependants() {

}

// gets the dependies of this module and all of the dependies of those dependies
function getDependies(moduleName) {
    
}

// same as getDependies but only includes installed modules
function getInstaledDependies(moduleName) {
    
}

// same as getDependies but does not include optional dependies
function getRquiredDependies(moduleName) {
    
}

// gets the modules which are dependent of this module
function getDependants(moduleName) {
    
}

// same as getDependants but only includes installed modules
function getInstaledDependants(moduleName) {
    
}

// same as getDependies but does not include optional dependies
function getRquiredDependants(moduleName) {
    
}

// this converts the tree to not require multiple indexing
function flattenTree(tree) {

}

// this resolves each member to a value based on a function, default is due set value to true if all of its dependents are true
function resolveTree(tree,qurey) {
    
}

return {
    dependies: treeDependies,
    dependents: treeDependants,
    flatten: flattenTree,
    resolve: resolveTree,
    module: {
        dependies: getDependies,
        dependiesInstalled: getInstaledDependies,
        dependiesRequired: getRquiredDependies,
        dependents: getDependants,
        dependentsInstalled: getInstaledDependants,
        dependentsRequired: getRquiredDependants
    }
}