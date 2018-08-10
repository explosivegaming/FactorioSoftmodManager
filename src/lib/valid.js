const valid_keys=['name','type','description','version','modules','submodules','dependencies']
const keywords_keys=['location','keywords','collection'].concat(valid_keys)
const author_keys=['author','contact','license'].concat(keywords_keys)
const config = require('../config.json')

// the most basic information that every json will have
function valid(data,no_remove) {
    if (data.name && data.type) {
        if (!data.description) data.description='<blank>'
        if (!data.version) data.description='1.0.0'
        if (data.type == 'Secenario' && !data.modules) data.modules={}
        else if (data.type == 'Collection' && !data.submodules) data.submodules={}
        else if (!data.dependencies) data.dependencies={}
        if (config.cleanModules && !no_remove) for (let key in data) if (!valid_keys.includes(key)) delete data[key]
        return true
    } else return false
}

// submodules will not include author details in them
function keywords(data,no_remove) {
    if (valid(data,true)) {
        if (!data.location) return false
        if (!data.keywords) data.keywords=[]
        if (config.cleanModules && !no_remove) for (let key in data) if (!keywords_keys.includes(key)) delete data[key]
        return true
    } else return false
}

// modules and collections will have author details
function author(data,no_remove) {
    if (keywords(data,true)) {
        if (!data.author) data.author='<blank>'
        if (!data.contact) data.contact='<blank>'
        if (!data.license) data.license='<blank>'
        if (config.cleanModules && !no_remove) for (let key in data) if (!author_keys.includes(key)) delete data[key]
        return true
    } else return false
}

// most values will be asgined a default if not present and remove extra keys, if false is returned then the module was missing key information
module.exports = {
    secnario: valid,
    collection: author,
    submodule: keywords,
    module: author
}