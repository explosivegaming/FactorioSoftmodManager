const fs = require('fs-extra')
const database = require('../lib/database.js')
const semver = require('semver')

const [consoleLog,errorLog] = require('../lib/consoleLog')
const Softmod = require('../lib/Softmod')
const rootDir = process.env.dir

const Express = require('express')
const app = Express()

app.use('/softmod',require('../routes/softmod'))
app.use('/archive',require('../routes/archive'))

function convertJson(json) {
    const softmod = Softmod.fromJson(json)
    const version = semver.coerce(softmod.version)
    const keywords = softmod.jsonValue('keywords') || []
    return {
        details: {
            name:softmod.name,
            author: softmod.jsonValue('author'),
            description: softmod.jsonValue('description'),
            license: softmod.jsonValue('license'),
            keywords: keywords.join(';')
        },
        version: {
            name:softmod.versionName,
            json:json,
            versionMajor: version.major,
            versionMinor: version.minor,
            versionPatch: version.patch
        }
    }
}

function addWatch(interval=500) {
    consoleLog('status','Starting watch with interval: '+interval)
    const importsDir = rootDir+'/imports'
    fs.watch(importsDir,(event,file) => {
        if (event == 'rename' && fs.existsSync(`${importsDir}/${file}`)) {
            if (file.endsWith('.json')) {
                // the file is a json file
                fs.readJSON(`${importsDir}/${file}`)
                .catch(errorLog)
                .then(json => {
                    const converted = convertJson(json)
                    database.Softmods.upsert(converted.details).then(() => {
                        database.Softmods.findOne({
                            where:{
                                name:converted.details.name
                            }
                        }).then(softmodEntry => {
                            database.Versions.create(converted.version).then(entry => {
                                entry.setSoftmod(softmodEntry).then(() => {
                                    consoleLog('success','Created new entry: '+converted.version.name)
                                })
                                softmodEntry.addVersion(entry)
                            }).catch(errorLog)
                        }).catch(errorLog)
                    }).catch(errorLog)
                }).catch(errorLog)
                fs.remove(`${importsDir}/${file}`)
            } else if (file.endsWith('.zip')) {
                fs.move(`${importsDir}/${file}`,`${rootDir}/archive/${file}`)
                .then(() => consoleLog('success','Copyied zip file to archive: '+file))
                .catch(errorLog)
            }
        }
    })
}

module.exports = async cmd => {
    consoleLog('status','Checking file structure and database')
    fs.ensureDir(rootDir+'/imports')
    fs.ensureDir(rootDir+'/archive')
    if (await database.authenticate()) {
        if (cmd.watch) await addWatch(typeof cmd.watch != 'boolean' ? cmd.watch : undefined)
        consoleLog('status','Starting web server')
        app.listen(cmd.port,cmd.address, () => {
            consoleLog('start','Server started on: '+cmd.port)
        })
        consoleLog('status','Command Finnished')
    }
}