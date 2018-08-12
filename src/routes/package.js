const Express = require('express')
const Router = Express.Router()
const {ModuleJson} = require('./../database')
const Version = require('../lib/version')
const Op = require('sequelize').Op

const removeE = {
    [Op.lt]:Op.lt,
    [Op.lte]:Op.lt,
    [Op.gt]:Op.gt,
    [Op.gte]:Op.gt
}

function addVersion(version,parts,offset,op) {
    if (op == '^') {
        version.push({
            versionMajor: {[Op.eq]: parts[offset]},
            versionMinor: {[Op.gte]: parts[offset+1]}
        })
    } else if (op == '~') {
        version.push({
            versionMajor: {[Op.eq]: parts[offset]},
            versionMinor: {[Op.between]: [parts[offset+1]-2,parts[offset+1]+2]}
        })
    } else if (op == '=') {
        version.push({
            versionMajor: {[Op.eq]: parts[offset]},
            versionMinor: {[Op.eq]: parts[offset+1]},
            versionPatch: {[Op.eq]: parts[offset+2]}
        })
    } else {
        version.push({
            [Op.or]: [
                {versionMajor:{[removeE[op]]: parts[offset]}},
                {[Op.and]: {
                        versionMajor: {[Op.eq]: parts[offset]},
                        versionMinor: {[removeE[op]]: parts[offset+1]}
                }},
                {[Op.and]: {
                        versionMajor: {[Op.eq]: parts[offset]},
                        versionMinor: {[Op.eq]: parts[offset+1]},
                        versionPatch: {[op]: parts[offset+2]}
                }}
            ]
        })
    }
}

function testVersion(version,parts,offset) {
    switch (parts[offset]) {
        case '<': addVersion(version,parts,offset+1,Op.lt); break
        case '<=': addVersion(version,parts,offset+1,Op.lte); break
        case '>': addVersion(version,parts,offset+1,Op.gt); break
        case '>=': addVersion(version,parts,offset+1,Op.gte); break
        case '^': addVersion(version,parts,offset+1,'^'); break
        case '~': addVersion(version,parts,offset+1,'~'); break
        case '': addVersion(version,parts,offset+1,'='); break
        case undefined: break
    }
}

Router.get('/:name',(req,res) => {
    const name = req.params.name
    const version = req.query.version || '*'
    const version_reqs = version.split('|')
    const version_query = {[Op.or]: [],name: name}
    for (let i = 0;i < version_reqs.length;i++) {
        const version_parts = version_reqs[i].match(/(\*)|(?:(\??(?=[<>^~\d]))([<>^~]?=?(?=\d))(\d+)\.(\d+)\.(\d+)([<>^~]?=?(?=\d))(\d+)\.(\d+)\.(\d+)?)|(?:(\??(?=[<>^~\d]))([<>^~]?=?(?=\d))(\d+)\.(\d+)\.(\d+))/)
        if (!version_parts) {res.status(400);res.send('Error 400 Bad Request: Could not parse version query.');return}
        if (version_parts[1]) {
            delete version_query[Op.or]
            break
        }
        const part = version_query[Op.or][version_query[Op.or].push({[Op.and]:[]})-1][Op.and]
        testVersion(part,version_parts,3)
        testVersion(part,version_parts,7)
        testVersion(part,version_parts,12)
    }
    ModuleJson.findAll({where: version_query, attributes: ['version','versionMajor','versionMinor','versionPatch','json']}).then(results => {
        if (!results || results.length == 0) {res.status(404);res.send('Error 404 Not Found: Could not find any versions within range.'); return}
        const alterantives = []
        for (let i = 0;i < results.length;i++) alterantives.push(results[i].version)
        const latest = Version.max(alterantives)
        const latest_index = alterantives.indexOf(latest)
        const latest_json = results[latest_index]
        res.json({latest:latest,alterantives:alterantives.sort(),json:latest_json.json})
    })
})

module.exports = Router