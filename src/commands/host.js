// require
const config = require('./../config.json')
const app = require('./../app')
const database = require('./../database')

module.exports = (options) => {
    const port = options.port || config.hostPort
    database.authenticate()
    if (options.dev) app.use_raw()
    app.listen(port, () => {
        console.log('Server started on port: '+port)
    })
}