const Sequelize = require('sequelize');

const sequelize = new Sequelize('factorioSoftmodManager',null,null,{
    dialect: 'sqlite',
    storage:'factorioSoftmodManager.db',
    operatorsAliases: false,
});

const ModuleJson = sequelize.define('jsons', {
    name: Sequelize.STRING,
    version: Sequelize.STRING,
    isSubModule: Sequelize.BOOLEAN,
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