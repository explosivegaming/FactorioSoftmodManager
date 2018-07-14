#! /usr/bin/env node
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
    .option('-t, --type <type>','defines the type of the module, Scenario|Collection|Module|Submodule')
    .option('-v, --module-version <version>','defines the version of the module')
    .option('-u, --url <url>','defines the url location for the module')
    .option('-a, --author <author>','defines the author for the module')
    .option('-l, --license <license>','defines the license type or location of the modules license')
    .option('-c, --contact <contact>','defines the contact method and/or location for this contact')
    .option('-k, --key-words <keyword>,[keyword]','defines a list of key words for the module',val => val.split(','))
    .action(require('./commands/init'))

program
    .command('build [dir]')
    .description('builds the module or collection and will give the exports which can then be added to the host')
    .option('-u, --url <url>','the base url which will be used as the host for the urls, such as a git version (...releases/download/v4.0-core/)')
    .action(require('./commands/build'))

// install command (used to install a scenario/module/collection/submodule)
program
    .command('install <name> [dir]')
    .description('installs all modules that are required to run a secario or adds a dependencie for a module')
    .option('-y, --yes-all','skips all prompts')
    .option('-d, --dry-run','will not download any thing but will move and create files')
    .option('-f, --force','forces files to be overriden during install')
    .option('-v, --module-version <version>','defines which version will be retrived')
    .action(require('./commands/install'))

program
    .command('uninstall [name] [dir]')
    .description('uninstalls this module and any dependices that are exclusive to the selected module')
    .option('-c, --clear-jsons','removes all jsons and does not touch any modules')
    .option('-j, --remove-json','will also remove the downloaded json file if it is present')
    .option('-l, --keep-locale','does not remove the locale file for the modules')
    .option('-a, --remove-all','remove all fsm files from this scenario')
    .action(require('./commands/uninstall'))

// update command (same as init but only updates modules/submodules)
program
    .command('update [dir]')
    .description('place holder for a furture update command')
    .action(require('./commands/update'))

// host command (starts a host server, in furture this will connect to a master to allow more than a single host)
program
    .command('host [dir]')
    .description('place holder for a furture host command')
    .option('-p, --port','port to host server on')
    .option('-u, --update','loads new modules from the modules folder into the database')
    .option('-i, --use-index','loads new modules from the json dir')
    .option('-w, --watch [interville]','watchs the selected dir for new json files and adds them to the database, then removes them')
    .option('-d, --dev','allows use of /raw route for dev purposes')
    .action(require('./commands/host'))

// program info
program
    .version('0.1.0')
    .usage('fsm <command> [options]')
    .description('(WIP) A cli to download and install softmods for a factorio scenario')

program
    .command('test [dir]')
    .action(async (dir='.',options) => {
        const tree = require('./lib/tree')
        const Tree = await tree.dependents(dir)
        console.log(Tree)
        console.log(tree.flatten(Tree))
    })

// if no command then it displays help
if (process.argv[2]) program.parse(process.argv)
else program.help()

module.exports = () => {
    program.parse(arguments.join(' '))
}