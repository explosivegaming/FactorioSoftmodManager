const Sequelize = require('sequelize')
const [consoleLog,errorLog] = require('./consoleLog')

// look into replication.read and replication.write
const sequelize = new Sequelize('factorioSoftmodManager',null,null,{
    dialect: 'sqlite',
    storage:process.env.databasePath,
    operatorsAliases: false,
    logging: line => consoleLog('info',line),
    pool: {
        max: 5,
        idle: 30000,
        acquire: 60000,
    }
});

const Softmods = sequelize.define('softmods',{
    name: {
        type:Sequelize.STRING,
        unique:true
    },
    author: Sequelize.STRING,
    description: Sequelize.STRING,
    license: Sequelize.STRING,
    keywords: Sequelize.STRING // mysql cant hanndle arrays using .join(';') and .split(';')
})

const Versions = sequelize.define('versions',{
    name: {
        type:Sequelize.STRING,
        unique:true
    }, // this will include a version tag so this is different to ModuleInfo.name
    json: Sequelize.JSON
})

Versions.softmod = Versions.belongsTo(Softmods,{as:'Softmod',foreignKey:'softmodID'})
Softmods.versions = Softmods.hasMany(Versions,{as:'Versions',foreignKey:'softmodID'})

function authenticate() {
    consoleLog('start','Syncing with database')
    return new Promise((resolve,reject) => {
        sequelize.authenticate().then(() => {
            consoleLog('success','Connection has been established successfully.')
            sequelize.sync().then(() => {
                consoleLog('success','Database syncing has been successful.')
                resolve(true)
            }).catch(reject)
        }).catch(err => {
            consoleLog('error','Unable to connect to the database: '+err)
            return false
        })
    }).catch(errorLog)
}

module.exports = {
    rawDatabase: sequelize,
    authenticate: authenticate,
    Versions: Versions,
    Softmods: Softmods
}