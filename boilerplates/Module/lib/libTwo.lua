--- Description - A small description that will be displayed on the doc
-- @submodule Module Name - This is unique name that is given to this module
-- @alias ModuleName - This is how other modules will be to access this module ie ModuleName.foo()
-- @author Name - The author or team behind this module
-- @license link - Either a link to the module's license (ie on git) or path to file from module root if included

-- notice that it is now labled as submodule, if you wish this to be in its own category (if it is large submodule) then use module and name it "Module Name.Submodule Name"

--- This file will be loaded when OptianlModule is present
-- @function _comment
 
--- Funcation C
-- @usage ModuleName.fun() -- returns 'foo'
-- @treturn string 'fun'
function ModuleName.fun()
    return 'fun'
end

-- no return is needed as the module is already loaded as this file is loaded during on_init