#! /usr/bin/env node
const program = require('commander')
const fs = require('fs-extra')
const config = require('./config')
const consoleLog = require('./lib/consoleLog')

async function softmodDirVal(name='.',dir='.',cmd,path) {
    // if the name is a path then it is used instead of dir
    if (name.includes('/') || name.includes('\\') && dir == '.') {dir = name;name='.'}
    process.env.dir = dir
    const Softmod = require('./lib/Softmod') // loaded here because of process.env.dir
    // if no module is given then it will look in the current dir to find a json file
    let softmod
    if (name == '.') {
        if (fs.existsSync(process.env.dir+config.jsonFile)) {
            const json = fs.readJSONSync(process.env.dir+config.jsonFile)
            if (json) softmod = Softmod.fromJson(json)
            else {
                consoleLog('error','No softmod name supplied and no json found.')
                return
            }
        }
    } else {
        const [softmodName,softmodVersionQuery] = Softmod.extractVersionFromName(name,true)
        softmod = new Softmod(softmodName,cmd.parent.modulesVersion ? cmd.parent.modulesVersion : softmodVersionQuery)
        if (!cmd.parent.download) {
            const json = await softmod.readJson(true)
            if (!json) {
                consoleLog('error','Softmod not installed and download is disabled')
                return
            }
        }
    }
    process.env.download = cmd.parent.download || ''
    process.env.useForce = cmd.parent.force || ''
    process.env.skipUserInput = cmd.parent.yesAll || cmd.parent.noAll || ''
    process.env.skipUserInputValue = cmd.parent.yesAll || ''
    // runs the command
    require(path)(softmod,cmd)
}

// info command (displays info on a module/collection/scenario/submodule)
program
    .command('info [name] [dir]')
    .description('View info on a module, collection or secenario')
    .action((name,dir,cmd) => softmodDirVal(name,dir,cmd,'./commands/info'))

// init command (creats the json and auto links submodules)
program
    .command('init [dir]')
    .description('Init a new module, collection or secanrio')
    .option('-y, --yes-all','skips all prompts')
    .option('-n, --module-name <name>','defines the name of this module')
    .option('-t, --type <type>','defines the type of the module, Scenario|Collection|Module|Submodule')
    .option('-v, --module-version <version>','defines the version of the module')
    .option('-u, --url <url>','defines the url location for the module')
    .option('-a, --author <author>','defines the author for the module')
    .option('-l, --license <license>','defines the license type or location of the modules license')
    .option('-c, --contact <contact>','defines the contact method and/or location for this contact')
    .option('-k, --key-words <keyword>,[keyword]','defines a list of key words for the module',val => val.split(','))
    .action((dir='.',cmd) => {
        process.env.dir = dir
        require('./commands/init')(cmd)
    })

program
    .command('build [dir]')
    .description('Builds the module or collection and will give the exports which can then be added to the host')
    .option('-u, --url <url>','the base url which will be used as the host for the urls, such as a git version (...releases/download/v4.0-core/)')
    .action((dir='.',cmd) => {
        process.env.dir = dir
        require('./commands/build')(cmd)
    })

// install command (used to install a scenario/module/collection/submodule)
program
    .command('install [name] [dir]')
    .description('Installs all modules that are required to run a secario or adds a dependencie for a module')
    .option('-d, --dry-run','will not download any thing but will move and create files')
    .option('-z, --keep-zips','does not remove zip files after download')
    .option('-j, --keep-jsons','does not remove json dir after download')
    .action((name,dir,cmd) => softmodDirVal(name,dir,cmd,'./commands/install'))

program
    .command('uninstall [name] [dir]')
    .description('Uninstalls this module and any dependices that are exclusive to the selected module')
    .option('-r, --no-recursion','uninstalls all dependices if there are no longer needed')
    .option('-j, --clear-jsons','removes temp json dir')
    .option('-a, --all','remove all fsm files from this scenario')
    .action((name,dir,cmd) => softmodDirVal(name,dir,cmd,'./commands/uninstall'))

// update command (same as init but only updates modules/submodules)
program
    .command('update [dir]')
    .description('Updates modules, submodules and collections to all have the same information')
    .action((dir='.',cmd) => {
        process.env.dir = dir
        require('./commands/update')(cmd)
    })

// host command (starts a host server, in furture this will connect to a master to allow more than a single host)
program
    .command('host [dir]')
    .description('Sets up a web api endpoint on this machine; a place holder for allowing uploading of modules')
    .option('-p, --port','port to host server on')
    .option('-u, --update','loads new modules from the modules folder into the database')
    .option('-i, --use-index','loads new modules from the json dir')
    .option('-w, --watch [interville]','watchs the selected dir for new json files and adds them to the database, then removes them')
    .option('-d, --dev','allows use of /raw route for dev purposes')
    .action((dir='.',cmd) => {
        process.env.dir = dir
        require('./commands/host')(cmd)
    })

program
    .command('test [dir]')
    .description('a test command')
    .action(async (dir='.',cmd) => {
        process.env.dir = dir
        const Softmod = require('./lib/Softmod')
        const softmod = new Softmod('ExpGamingCore.Gui')
        await softmod.readJson(true)
        await softmod.build(true,true)
    })

// program info
program
    .version('0.1.0')
    .usage('fsm <command> [options]')
    .option('-d, --no-download','will not download any files')
    .option('-f, --force','forces the prossess to run when it would cancel normally')
    .option('-y, --yes-all','skips all prompts, accepting all')
    .option('-n, --no-all','skips all prompts, accepting only to contuine install')
    .option('-v, --module-version <version>','defines which version will be acted on (when aplicaible)')
    .description('A cli to download and install softmods for a factorio scenario')

// if no command then it displays help
if (process.argv[2]) program.parse(process.argv)
else program.help()

module.exports = () => {
    program.parse(arguments.join(' '))
}