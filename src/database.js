const Sequelize = require('sequelize')
const config = require('./config.json')

const sequelize = new Sequelize('factorioSoftmodManager',null,null,{
    dialect: 'sqlite',
    storage:config.database,
    operatorsAliases: false,
});

const ModuleJson = sequelize.define('jsons', {
    name: Sequelize.STRING,
    version: Sequelize.STRING,
    versionMajor: Sequelize.INTEGER,
    versionMinor: Sequelize.INTEGER,
    versionPatch: Sequelize.INTEGER,
    json: Sequelize.JSON
})

function authenticate () {
    sequelize.authenticate().then(() => {
        console.log('Connection has been established successfully.');
        sequelize.sync()
    }).catch(err => {
        console.error('Unable to connect to the database:', err);
    });
}

module.exports = {
    database: sequelize,
    authenticate: authenticate,
    ModuleJson: ModuleJson
}