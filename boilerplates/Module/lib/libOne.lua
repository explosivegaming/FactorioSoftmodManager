--- Description - A small description that will be displayed on the doc
-- @submodule Module Name - This is unique name that is given to this module
-- @alias ModuleName - This is how other modules will be to access this module ie ModuleName.foo()
-- @author Name - The author or team behind this module
-- @license link - Either a link to the module's license (ie on git) or path to file from module root if included

-- notice that it is now labled as submodule, if you wish this to be in its own category (if it is large submodule) then use module and name it "Module Name.Submodule Name"

--- Funcation B - as this is local the function tag is required
-- @function LibOne.bar
-- @usage LibOne.bar() -- returns 'bar'
-- @treturn string 'bar'
local function bar()
    return 'bar'
end

-- this can be done instead of starting the file with local Module = {}
return {
    bar = bar
}