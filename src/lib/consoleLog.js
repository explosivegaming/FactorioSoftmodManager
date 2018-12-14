const chalk = require('chalk')
const moment = require('moment')

function logType(type) {
    const output = '['+type.charAt(0).toUpperCase()+type.toLowerCase().slice(1)+']'
    switch (type.toLowerCase()) {
        case 'info':
            return chalk.cyan(output)
        case 'start':
        case 'success':
            return chalk.green(output)
        case 'fail':
        case 'end':
        case 'stop':
        case 'error':
            return chalk.red(output)
        case 'status':
            return chalk.magenta(output)
        case 'input':
        case 'warning':
            return chalk.yellow(output)
        case 'verbose':
            return chalk.gray(output)
        default:
            return output;
    }
}

function consoleLog(type,message) {
    console.log(chalk`{grey ${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}} ${logType(type)} ${message}`)
}

const errors = []

module.exports = {
    finaliseLog: function() {
        consoleLog('status','Command Finnished')
        if (errors.length > 0) {
            consoleLog('status','There were the following errors:')
            console.log(errors.map(str => chalk`${logType('error')} ${str}`).join('\n'))
        }
    },
    errorLog: function(err) {
        consoleLog('error',err)
        errors.push(err)
    },
    consoleLog: consoleLog,
    errors: errors
}