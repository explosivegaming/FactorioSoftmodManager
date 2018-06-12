const Express = require('express')

const app = Express()

app.use_raw = () => app.use('/raw',require('./routes/raw'))
app.use('/package',require('./routes/package'))

module.exports = app