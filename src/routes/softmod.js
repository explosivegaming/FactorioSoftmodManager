const Express = require('express')
const router = Express.Router()
const database = require('../lib/database')
const semver = require('semver')
const Softmod = require('../lib/Softmod')

router.param('softmodName',(req,res,next,value,name) => {
    let [softmodName,softmodVersion] = Softmod.extractVersionFromName(req.params.softmodName,true)
    req.params.softmodName = softmodName
    req.params.softmodVersion = softmodVersion
    next()
})

router.get('/:softmodName/versions',(req,res) => {
    const softmodName = req.params.softmodName
    const query = req.query.v || req.params.softmodVersion
    const softmodData = {}
    database.Softmods.findOne({
        where: {
            name: softmodName
        }
    }).then(softmod => {
        if (!softmod) {
            res.status(404).send('Softmod not found: '+softmodName)
        } else {
            softmod.getVersions().then(versions => {
                const rawVersions = versions.map(version => Softmod.extractVersionFromName(version.name))
                const latest = semver.maxSatisfying(rawVersions,query)
                if (!latest) {
                    res.status(404).send('No versions found in range: '+query)
                } else {
                    softmodData[`${softmodName}@latest`]=versions[rawVersions.indexOf(latest)]
                    const options = rawVersions.filter(version => semver.satisfies(version,query))
                    options.forEach(version => {
                        softmodData[`${softmodName}@${version}`]=versions[rawVersions.indexOf(version)].json
                    })
                    res.json(softmodData)
                }
            })
        }
    }).catch(err => consoleLog('error',err))
})

router.use('/:softmodName',(req,res) => {
    const softmodName = req.params.softmodName
    const softmodData = {name:softmodName}
    database.Softmods.findOne({
        where: {
            name: softmodName
        }
    }).then(softmod => {
        if (!softmod) {
            res.status(404).send('Softmod not found: '+softmodName)
        } else {
            softmodData.author = softmod.author
            softmodData.description = softmod.description
            softmodData.license = softmod.license
            softmodData.keywords = softmod.keywords.split(';')
            softmod.getVersions().then(versions => {
                softmodData.versions = semver.sort(versions.map(version => Softmod.extractVersionFromName(version.name))).reverse()
                softmodData.latestVersion = semver.maxSatisfying(softmodData.versions,req.params.softmodVersion)
                if (softmodData.latestVersion) {
                    softmodData.latestJson = versions[softmodData.versions.length-softmodData.versions.indexOf(softmodData.latestVersion)-1].json
                } else softmodData.latestVersion = 'non in range'
                res.json(softmodData)
            })
        }
    }).catch(err => consoleLog('error',err))
})

/*router.get('/:softmodName',(req,res) => {
    res.status(404).send('Softmod file not found: '+req.params.softmodName)
})*/

module.exports = router