const program = require('commander')

// info command (displays info on a module/collection/scenario/submodule)
program
    .command('info [dir]')
    .description('view info on a module, collection or secenario')
    .option('-m, --module [module]','view info on a submodule of a collection',(val,modules) => {modules.push(val); return modules},[])
    .action(require('./commands/info'))

// init command (creats the json and auto links submodules)
program
    .command('init [dir]')
    .description('init a new module, collection or secanrio')
    .option('-y, --yes-all','skips all prompts')
    .option('-n, --module-name <name>','defines the name of this module')
    .option('-m, --module <type>','defines the type or the loaded name of the module')
    .option('-v, --module-version <version>','defines the version of the module')
    .option('-u, --url <url>','defines the url location for the module')
    .option('-a, --author <author>','defines the author for the module')
    .option('-l, --license <license>','defines the license type or location of the modules license')
    .option('-c, --contact <contact>','defines the contact method and/or location for this contact')
    .option('-k, --key-words <keyword>,[keyword]','defines a list of key words for the module',val => val.split(','))
    .action(require('./commands/init'))

// install command (used to install a scenario/module/collection/submodule)
program
    .command('install [name] [dir]')
    .description('installs all modules that are required to run a secario or adds a dependencie for a module')
    .option('-d, --dry-run','will not download any thing but will move and create files')
    .option('-f, --force','forces files to be overriden during install')
    .option('-y, --yes-all','skips all prompts')
    .action(require('./commands/install'))

// update command (same as init but only updates modules/submodules)
program
    .command('update [dir]')
    .description('place holder for a furture update command')

// host command (starts a get server, in furture will be replaced will a post to host new modules)
program
    .command('host [dir]')
    .description('place holder for a furture host command')
    .option('-p, --port','port to host server on')
    .option('-u, --update','updates the data base for the modules within the modules dir')
    .option('-d, --dev','allows use of /raw route for dev purposes')
    .action(require('./commands/host'))

// program info
program
    .version('0.1.0')
    .usage('fsm <command> [options]')
    .description('(WIP) A cli to download and install softmods for a factorio scenario')

// if no command then it displays help
if (process.argv[2]) program.parse(process.argv)
else program.help()