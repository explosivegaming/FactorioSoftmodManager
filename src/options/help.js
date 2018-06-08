// require 
const Chalk = require('chalk')

// define help
const help = {
    usage: 'fsm [options]',
    options: {
        '-h, --help': 'Displays help menu.',
        '-i, --info [dir]': 'Displays info about the item in this file.'
    }
}

// function to output help
module.exports = () => {
    for (let cat in help) {
        let data = help[cat]
        console.log(Chalk` {underline ${cat}}`)
        if (typeof data === 'string') {
            console.log('  '+data)
        } else if (typeof data === 'object') {
            let pad = 0
            for (let key in data) {
                if (key.length > pad) {
                    pad = key.length
                }
            }
            for (let key in data) {
                let str = data[key]
                console.log(`  ${key.padEnd(pad)} ${str}`)
            }
        }
        console.log()
    }
}