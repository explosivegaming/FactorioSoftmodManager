<p align="center">
  <img alt="logo" src="https://avatars2.githubusercontent.com/u/39745392?s=200&v=4" width="120">
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

## Init
`fsm init [dir] [options]`

Creates a new json file in the dir and asks promts to the user that you can use to easily fill all the requirements for a module json file. Creating a "Scenario" will load all installed modules into the json; Creating a "Collection" will load all installed submodules into the json; Creating a module (any other name given to --module-name) will not have any other data added by the script. See below and in tests for help on making modules.

__Options:__
* -y, --yes-all: this will skip all questions and use the default values
* -n, --module-name \<name>: the value that will be used for the name, if emited then promt will be given.
* -m, --module \<name>: when loaded in game it can be asscessed by this name, if Scenario or Collection acts as a type defination
* -t, --type \<type>: can be once of Scenario, Collection or Module and the script may also accept Submodule but it is advised not to do this
* -v, --module-version \<version>: the value that will be used for the version, must be X.Y.Z
* -u, --url \<url>: the url that will be used for the download location of the module, not required for Scenario type
* -a, --author \<author>: the author's name or account that will be present in the info
* -l, --license \<license>: the license type or the location of the license, recoment path or url
* -c, --contact \<contact>: the contact method that should be used to report bugs or request features
* -k, --key-words \<keyword>,[keyword]: list of key words to describe the module
  
__Creating a module:__

Once a json has been created you should start by creating a locale dir and a src dir, these can be used to store the locale files for the module and any extra scripts that can are used by your module. Any locale files should be named lang.cfg for example en.cfg or fr.cfg and all contained within the one folder, the manager will handle the rest. Then creating a control.lua for the module will act as the root for the module being loaded by the manager. "error", "script" and "global" have been modified to allow easise of devoplment with all conflicts beening hanndled by the manager. There is also two functions which can be defined: ":on_init()" and ":on_post()"; on_init should be used to hanndle optinal dependieces and then on_post should be used to finilise data after other modules may have changed something during init.

__Creating a collection:__

Once a json has been set up, with type as Collection, you only need to add a folder for each submodule, each submodule folder should contain the same as any other module including a json and be created with type as Module. Then once you have added your module you use the update command to update the collection to include the new submodules. When you require modules that are in the same collection you should treat them as if there weren't in the same collection, because as for as the manager is concerned these modules are not connected so the collection name must still be specififed (Collection.Submodule).

__Creating a scenario:__

This is by far the easiest to do as it requires no coding and only needs you to mannily edit the json to add any modules you want it to install. The scenario version should be the version of faactorio it was made for. The type should be definded as Scenario.

## Update
`fsm init [dir]`

Does the same job as init but does not replace any values in the json, used only to update scenarios and collections with new submodules or modules which have been added to them. Dir should be the dir of the scenario or the collection that will be updated.

## Build
`fsm build [dir] [options]`

Used to automaticaly export all json files to be added to the database; also zips all the modules and moves them to an export folder to be hosted on your url location. When it is given a url to use it will automaticly insert that url onto all modules and then appends the url with the module name.

__Options:__
* -u, --url \<ulr>: the base url which will be used as the host for the urls, such as a git version (...releases/download/v4.0-core/)

## Info
`fsm info [dir] [options]`

Displays the info about a scenario, module, collection or submodule in a clean way on the command line. Dir should point to the scenario and then using -m to access the modules and submodules of a collection. the option -m can be chained upto two times to go from scenario to collection to submodule any extra will be ingroned.

__Options:__
* -m, --module \<module>: the module of a scenario or the submoule of a collection

## Install
`fsm install [name] [dir] [options]`

The main feature of this script, allows you to download and install softmods or full scenarios. The name given will be looked up on the index database to retive a json file, this json file can then be used to get the download location and any dependieces that are required. If a sceanrio is given as the name then all the modules for that secnario are downloaded; if a collection is given then all the submodules of that collection and their dependieces will be downloaded; if it is a module then the module and its dependices will be downloaded. If there are optional dependices then the user will be asked if their want these to be installed or not. Once all are installed then starting the scenario will load all of the modules and their data. The name of the module can include @X.Y.Z if you wish to ask for a version rather than using the -v option.

__Options:__
* -y, --yes-all: will skip all promts using the default values
* -d, --dry-run: will run the install but will skip any downloading, only creates lua index and moves locale files
* -f, --force: forces a reinstall of all modules that are downloaded, does not effect modules not downloaded
* -v, --module-version \<version>: the version of the module to get, can also use name@version 

__Versions:__
* X.Y.Z: will only accept this one version to be installed, most likely to cause conflicts
* \>X.Y.Z: will accept any version that is greater than the current version, same for \<
* \>=X.Y.Z: will accept any version greater or equle to this version, same for \<=
* \>X.Y.Z<X.Y.Z: will accept any within this range of version (non inclusive), \<=  and \>= can be used to make it inclusive
* \*: will accept any version, uses the lastest version that is accpeted by other modules
* \^X.Y.Z: will accept any version which is complatible with the selected (X=X and Y>=Y)
* \~X.Y.Z: will accept a small range of versions (X=X and Y in range +/-2)
* \?X.Y.Z: will show that this is an optional depentincy, not very useful for install command, works with any of the above

## Uninstall
`fsm uninstall [name] [dir] [options]`

The contary to install, will remove a module or collection and all of the unqiue dependecies (not used by another module). This prosscess will remove the locale files of that module and all other files within the module. Using -a tag will remove all of the fsm files that are within the scenario and restore the control.lua to the default factorio freeplay one. Using -c will not remove any modules but will instead clear the json dir of any downloaded jsons. Uninstall does not care about version and will remove which ever module it find by the given name.

__Options:__
* -c, --clear-jsons: clears the json dir and does not remove any modules, name does not need to be defined, first param will be used as the dir
* -a, --remove-all: removes all fsm files from the scenario and restores freeplay control.lua, name does not need to be defined, first param will be used as the dir
* -j, --remove-json: this will remove the downloaded json from the json dir when the module is uninstalled
* -l, --keep-locale: keeps the locale files of a module when the rest of the module is removed

## Host
`fsm host [dir] [options]`

Used to host a server that can be used by clients to retrive json files. This sets up a endpoint which accepts a name and a version qurey to send a json file. Uses an sql database inorder to store jsons and orignle jsons can be removed once there are loaded into the database.

__Options:__
* -p, --port \<port>: the port which the api will run on
* -u, --update: updates the database using the modules that are currently installed
* -i, --use-index: requires -u, will also load jsons from the json chache
* -w, --watch [interville]: will automaticly update the database with any jsons added to the selected dir
* -d, --dev: runs the api in dev mode allowing access to /raw endpoint
