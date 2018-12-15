<p align="center">
  <a href="https://explosivegaming.nl/">
    <img alt="logo" src="https://avatars2.githubusercontent.com/u/39745392?s=200&v=4" width="120">
  </a>
  <br>
  <a href="https://github.com/explosivegaming/FactorioSoftmodManager/tags">
    <img src="https://img.shields.io/github/tag/explosivegaming/FactorioSoftmodManager.svg?label=Release" alt="Release">
  </a>
  <a href="https://www.npmjs.com/package/fsm-cli">
    <img src="https://img.shields.io/npm/dt/fsm-cli.svg?label=Downloads" alt="Downloads">
  </a>
  <a href="https://github.com/explosivegaming/FactorioSoftmodManager/stargazers">
    <img src="https://img.shields.io/github/stars/explosivegaming/FactorioSoftmodManager.svg?label=Stars" alt="Star">
  </a>
  <a href="http://github.com/explosivegaming/FactorioSoftmodManager/fork">
    <img src="https://img.shields.io/github/forks/explosivegaming/FactorioSoftmodManager.svg?label=Forks" alt="Fork">
  </a>
  <a href="https://www.codefactor.io/repository/github/explosivegaming/factoriosoftmodmanager">
    <img src="https://www.codefactor.io/repository/github/explosivegaming/factoriosoftmodmanager/badge" alt="CodeFactor">
  </a>
  <a href="https://discord.me/explosivegaming">
    <img src="https://discordapp.com/api/guilds/260843215836545025/widget.png?style=shield" alt="Discord">
  </a>
</p>
<h2 align="center">Factorio Softmod Manager Repository</h2>
<br>

This npm module can be used to download and install softmods (mods which require no download by the player) for a server. Using the install command and providing the directory of the scenario folder (you will have to create one for now) it will download all modules in that scenario and all their dependieces once down you are free to start the game via host scenario. Unfortully a sideeffect of this is that you can no longer earn achievements.

## Instalation
`npm i -g fsm-cli`

This will download and install our package and it can be used from command line using the alais "fsm".

__Options:__ (most commands)
* -d, --no-download: no files will be downloaded and no api requests are made
* -f, --force: force will be used to override many restrictions
* -y, --yes-all: will skip all user prompts, accepting all
* -n, --no-all: will skip all user prompts, declining all but confirmations
* -v, --module-version: define the version of the module to get (when one is supplied)

## Init
`fsm init [name] [dir] [options]`

Creates a new json file in the dir and asks promts to the user that you can use to easily fill all the requirements for a module json file. Creating a "Scenario" will load all installed modules into the json; Creating a "Collection" will load all installed submodules into the json; Creating a module (any other name given to --module-name) will not have any other data added by the script. See below and in tests for help on making modules.

__Options:__
* -s, --scenario: Initiates a scenario rather than a softmod, see Creating a scenario
* -u, --url \<url>: Predefines the download url for the softmod, used with -y
* -a, --author \<author>: Predefines the author for the softmod, used with -y
* -l, --license \<license>: Predefines the license for the softmod, used with -y
* -c, --contact \<contact>: Predefines the contact method for the softmod, used with -y
* -k, --key-words \<keyword>,[keyword]: Predefines the keywords for the softmod, used with -y
  
__Creating a softmod:__

Running this command will cause a boiler print control.lua to be generated (unless you have made one already) with the details of the mod entered into it; there will also be a json file with the details. At the top of the file (control.lua) you should have all your requires, examples in boilerprint, this will allow you to access these modules from within your own. Then you should define the on_init and on_post functions which will be exported: on_init is ran after all modules are loaded and will serve the main perpose of testing for optional depenices, examples in boilderprint; on_post is ran after all modules have initinlised and should be used to test for changes to your modules (which may have been made during the init of different module). If your module requires a global index then you can include the global defaults as shown in the boiler print, if not you may remove this part. As a rule of thumb you should either keep all functions local unless it is part of the exported module; all attempts to make keys in the global lua table will be blocked and forced to be local. On a final note: all script events have been replaced (apart from on_nth_tick) to allow each module to run independly from each other, so script.on_event should be used rather than any external libiary. Once it is ready you should run the build command to update the json file and move the local files, install may be needed to install dependices.

__Creating a scenario:__

The proccess is the same as a softmod for the generation of the json file but then that is all that is needed so there is no need to make a control.lua. These files are used as a way to help install other modules and share full scenario packs. See install for how to install a scenario from one of these files.

## Build
`fsm build [name] [dir] [options]`

Used to update the dependices for a module, update its known submodules and copy local files to the global local dir. There is an option to export the modules which will copy the jsons to the exports dir and zip the modules and move the zips to the exports dir. There is also the -d which will update the control.lua for verbose see install. Also the option to auto increment the version number is here so that you can build a new version and export stright to the database.

__Options:__
* -b, --create-backup: creates a backup of every json in case you want to revert back to them
* -a, --all: will build every module currently installed, usefull for exporting
* -e, --export [dir]: will export the new jsons and create zip files
* -D, --dev [level]: will install a dev control.lua with verbose enabled, levels (default 4): none (none) 0 (errors) to 5 (event registers)
* -i, --version-increment [major|minor|patch]: increments the version of the selected module by one in the given area (defulat: patch)
* -I, --version-increment-all [major|minor|patch]: increments the version of all modules by one in the given area (defulat: patch)

## Info
`fsm info [name] [dir] [options]`

This will either read or download the json file for the selected module and display its infomation in the console. The dependinces will show which are options [?] and which are installed [#] as well as all the submodules that belong to this softmod and they descrions.

## Install
`fsm install [name] [dir] [options]`

The main feature of this script, allows you to download and install softmods or full scenarios. The name given will be looked up on the web database to retive a json file, this json file can then be used to get the download location and any dependieces that are required. If a sceanrio is given as the name then all the modules for that secnario are downloaded; if it is a softmod then the module and its dependices will be downloaded as well as any submodules that the soft mod has. If there are optional dependices then the user will be asked if their want these to be installed or not. Once all are installed then starting the scenario will load all of the modules and their data. The name of the module can include @X.Y.Z if you wish to ask for a version rather than using the -v option, if no version is given then the latest version is installed.

__Options:__
* -d, --dry-run: will run the install but will skip any downloading, only creates lua index and moves locale files
* -D, --dev [level]: will install a dev control.lua with verbose enabled, levels (default 4): none (none) 0 (errors) to 5 (event registers)
* -z, --keep-zips: does not remove zip files after download
* -j, --keep-jsons: does not remove json dir after download

__Versions:__
* X.Y.Z: will only accept this one version to be installed, most likely to cause conflicts
* \>X.Y.Z: will accept any version that is greater than the current version, same for \<
* \>=X.Y.Z: will accept any version greater or equle to this version, same for \<=
* \>X.Y.Z<X.Y.Z: will accept any within this range of version (non inclusive), \<=  and \>= can be used to make it inclusive
* \*: will accept any version, uses the lastest version that is accpeted by other modules
* \^X.Y.Z: will accept any version which is complatible with the selected (X=X and Y>=Y)
* \~X.Y.Z: will accept a small range of versions (X=X and Y in range +/-2)
* \?X.Y.Z: will show that this is an optional depentincy, not very useful for install command, works with any of the above
* For more info see systematic versioning

## Uninstall
`fsm uninstall [name] [dir] [options]`

The contary to install, will remove a module and all of the unqiue dependecies (not used by another module). This prosscess will remove the locale files of that module and all other files within the module. Using -a tag will remove all of the fsm files that are within the scenario and restore the control.lua to the default factorio freeplay one. Using -c will not remove any modules but will instead clear the json dir of any downloaded jsons.

__Options:__
* -r, --no-recursion: will only uninstall the selected module and not its dependicies
* -c, --clear-jsons: removes temp json dir if present
* -a, --all: removes all fsm files from the scenario and restores freeplay control.lua

## Host
`fsm host [dir] [options]`

Used to host a server that can be used by clients to retrive json files. This will cerate an imports, archieve and database in the selceted dir, imports will only be watched if -w is given. Any zip files withing the archive can be downloaded from the /archive endpoint and version qureyies are passed to the /softmod endpoint. Droping zips and jsons into the imports dir will cause them to be added to the database (for jsons)/archive (for zips).

__Options:__
* -p, --port \<port>: the port which the api will run on
* -u, --update: updates the database using the modules that are currently installed
* -w, --watch [interville]: will automaticly update the database with any jsons added to the selected dir
