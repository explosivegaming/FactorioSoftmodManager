// require
const express = require('express')
const default_port = 3000

const app = express()

app.get('/package/:name',(req,res) => {
    const name = req.params.name
    const version = req.query.version || '*'
    console.log(req.url)
    console.log(name)
    console.log(version)
    // replace with json file or url to json file
    res.send('Hello, World!')
})

module.exports = (options) => {
    const port = options.port || default_port
    app.listen(port, () => {
        console.log('Server started on port: '+port)
    })
}