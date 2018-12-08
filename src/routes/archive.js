const Express = require('express')
const router = Express.Router()

router.use('/',Express.static(process.env.dir+'/archive'))

router.get('/*',(req,res) => {
    if (req.path.endsWith('.zip')) res.status(404).send('Zip file not found: '+req.path.substring(req.path.lastIndexOf('/')+1))
    else res.redirect(`.${req.path}.zip`)
})

module.exports = router