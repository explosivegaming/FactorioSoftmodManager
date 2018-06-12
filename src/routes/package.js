const Express = require('express')
const Router = Express.Router()

Router.get('/:name',(req,res) => {
    const name = req.params.name
    const version = req.query.version || '*'
    console.log(req.url)
    console.log(name)
    console.log(version)
    // replace with json file or url to json file
    res.send('Hello, World!')
})

module.exports = Router