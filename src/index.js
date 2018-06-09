const program = require('commander')

program
    .command('info [dir]')
    .description('view info on a module, collection or secenario')
    .option('-m, --module [module]','view info on a submodule of a collection')
    .action(require('./commands/info'))

program
    .command('init [dir]')
    .description('init a new module, collection or secanrio')
    .option('-y, --yes-all','skip all other options asked')
    .option('-n, --name','defines the name of this module')
    .option('-m, --module-name','defines the type or the loaded name of the module')
    .option('-v, --module-version','defines the version of the module')
    .option('-u, --url','defines the url location for the module')
    .option('-a, --author','defines the author for the module')
    .option('-l, --license','defines the license type or location of the modules license')
    .option('-c, --contact','defines the contact method and/or location for this contact')
    .option('-k, --key-words','defines a list of key words for the module',val => val.split(','))
    .action(require('./commands/init'))

program
    .version('0.1.0')
    .usage('fsm [command] [options]')
    .description('(WIP) A cli to download and install softmods for a factorio scenario')
    
    
if (process.argv[2]) program.parse(process.argv)
else program.help()