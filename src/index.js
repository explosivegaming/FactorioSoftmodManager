const program = require('commander')

program
    .command('info [dir]')
    .description('view info on a module, collection or secenario')
    .action(require('./commands/info'))

program
    .version('0.1.0')
    .usage('fsm [command] [options]')
    .description('(WIP) A cli to download and install softmods for a factorio scenario')
    
    
if (process.argv[2]) program.parse(process.argv)
else program.help()