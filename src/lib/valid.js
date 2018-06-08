function valid(data) {
    if (data.name && data.module) {
        if (!data.description) data.description='<blank>'
        if (!data.version) data.description='1.0.0'
        if (data.module === 'Secenario' && !data.modules) data.modules={}
        else if (data.module === 'Collection' && !data.submodules) data.submodules={}
        else if (!data.dependencies) data.dependencies={}
        return true
    } else return false
}

function keywords(data) {
    if (valid(data)) {
        if (!data.location) return false
        if (!data.keywords) data.keywords=[]
        return true
    } else return false
}

function author(data) {
    if (keywords(data)) {
        if (!data.author) data.author='<blank>'
        if (!data.contact) data.contact='<blank>'
        if (!data.license) data.license='<blank>'
        return true
    } else return false
}

module.exports = {
    secnario: valid,
    collection: author,
    submodule: keywords,
    module: author
}