--- Description - A small description that will be displayed on the doc
-- @module Module Name - This is unique name that is given to this module
-- @alias ModuleName - This is how other modules will be to access this module ie ModuleName.foo()
-- @author Name - The author or team behind this module
-- @license link - Either a link to the module's license (ie on git) or path to file from module root if included
local ModuleName={}

-- how to require files, note that the module (var ModuleName) will not be present during the require so it is recomened that extentions of the module be done durin on_init
local libOne = require(module_path..'/lib/libOne')

--- Funcation A
-- @usage ModuleName.foo() -- returns 'foo'
-- @treturn string 'foo'
function ModuleName.foo()
    return 'foo'
end

-- @local Creating a function called on_init will be ran by the manager once all other modules are loaded, you are able to test for optianl dependies or extend this module
function ModuleName:on_init()
    -- this file will extent the module during on_init so can be used to load more function if an optianl dependie if present, or to run a test file
    require(module_path..'/lib/libTwo')
end

-- return the module if needed, it will be appended to modules of the same name if there are modules which add to this one
return ModuleName