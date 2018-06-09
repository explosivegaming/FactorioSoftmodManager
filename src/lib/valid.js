const valid_keys=['name','module','description','version','modules','submodules','dependencies']
const keywords_keys=['location','keywords'].concat(valid_keys)
const author_keys=['author','contact','license'].concat(keywords_keys)

function valid(data,no_remove) {
    if (data.name && data.module) {
        if (!data.description) data.description='<blank>'
        if (!data.version) data.description='1.0.0'
        if (data.module === 'Secenario' && !data.modules) data.modules={}
        else if (data.module === 'Collection' && !data.submodules) data.submodules={}
        else if (!data.dependencies) data.dependencies={}
        if (!no_remove) for (let key in data) if (!valid_keys.includes(key)) delete data[key]
        return true
    } else return false
}

function keywords(data,no_remove) {
    if (valid(data,true)) {
        if (!data.location) return false
        if (!data.keywords) data.keywords=[]
        if (!no_remove) for (let key in data) if (!keywords_keys.includes(key)) delete data[key]
        return true
    } else return false
}

function author(data,no_remove) {
    if (keywords(data,true)) {
        if (!data.author) data.author='<blank>'
        if (!data.contact) data.contact='<blank>'
        if (!data.license) data.license='<blank>'
        if (!no_remove) for (let key in data) if (!author_keys.includes(key)) delete data[key]
        return true
    } else return false
}

module.exports = {
    secnario: valid,
    collection: author,
    submodule: keywords,
    module: author
}