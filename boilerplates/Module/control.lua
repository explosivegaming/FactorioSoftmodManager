--- Description - A small description that will be displayed on the doc
-- @module Module Name - This is unique name that is given to this module
-- @alias ModuleName - This is how other modules will be to access this module ie ModuleName.foo()
-- @author Name - The author or team behind this module
-- @license link - Either a link to the module's license (ie on git) or path to file from module root if included
local ModuleName={}
local module_verbose = false --true|false

--[[
    Global Varibles
    verbose function given a string param it will log that string if the conditions are met, eg module_verbose = true
    module_verbose boolean acts as a toggle for the verbose in this module, over rides global verbose settings
    module_exports table can be used rather than returning at the end of the file, return is the prefered method
    module_path string the current local of the module use during require
    module_name string this is a readonly varible that is the loaded name (var ModuleName) that this module is indexed by
    loaded_modules table a table that conatins all loaded modules, avibile during on_init and other events
    Manager.event table used to define event handlers, used in the same way that script would work; see doc
    script table a redirect to Manager.event
    Event table a redirect to Manager.event
    Manager.error table used to control errors and the handling of errors for modules; see doc
    error table a redirect to Manager.error
]]


-- how to require files, note that the module (var ModuleName) will not be present during the require so it is recomened that extentions of the module be done durin on_init
local libOne = require(module_path..'/src/libOne')
local global = Manager.global() -- this is optinal but will auto manage the global table

--- Funcation A
-- @usage ModuleName.foo() -- returns 'foo'
-- @treturn string 'foo'
function ModuleName.foo()
    verbose(module_name)
    return 'foo'
end
verbose(module_name)

-- this is how error handlers can be added
error.addHandler('Game Print',function(err)
    game.print('Error: '..err)
end)

-- this is how events can be added, each module is allowed one handler per event; however this will never conflict with another module
script.on_event('on_player_died',function(event)
    -- this will raise an error
    error('A player died!') 
end)

-- @local Creating a function called on_init will be ran by the manager once all other modules are loaded, you are able to test for optianl dependies or extend this module
function ModuleName:on_init()
    -- this file will extent the module during on_init so can be used to load more function if an optianl dependie if present, or to run a test file
    if loaded_modules.OptianlModule then require(module_path..'/src/libTwo') end
end

-- return the module if needed, it will be appended to modules of the same name if there are modules which add to this one
return ModuleName