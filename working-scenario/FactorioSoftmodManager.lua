-- Used to load all other modules that are indexed in index.lua
local moduleIndex = require("/modules/index")
local Manager = {}
--- Setup for metatable of the Manager to force read only nature
-- @usage Manager() -- runs Manager.loadModdules()
local ReadOnlyManager = setmetatable({},{
    __index=Manager,
    __metatable=false,
    __call=function(tbl)
        if #tbl.loadModules == 0 then
            tbl.loadModules()
        end
    end,
    __newindex=function(tbl,key,value)
        if key == 'currentState' then
            Manager.verbose('Current state is now: "'..value.. '"; The verbose state is now: '..tostring(Manager.setVerbose[value]),true) 
            rawset(Manager,key,value)
        else error('Manager is read only please use included methods')  end
    end,
    __tostring=function(tbl)
        return tostring(Manager.loadModules)
    end
})


Manager.currentState = 'selfInit'
-- selfInit > moduleLoad > moduleInit > moduleEnv

---- Setup of the verbose and verbose settings

--- Default output for the verbose
-- @usage Manager.verbose('Hello, World!')
-- @tparm rtn string the value that will be returned though verbose output
Manager._verbose = function(rtn)
    if game and Manager.setVerbose._output ~= true then Manager.setVerbose._output=true game.write_file('verbose.log',rtn)
    elseif game then game.write_file('verbose.log',rtn,true) end
    if print then print(rtn) end
    if _log then _log(rtn) end -- _log is a call to first line of control.lua to shorten log lines
end

--- Used to call the output of the verbose when the current state allows it
-- @usage Manager.verbose('Hello, World!')
-- @tparm rtn string the value that will be returned though verbose output
-- @tparm action string is used to decide which verbose this is error || event etc
Manager.verbose = function(rtn,action)
    local settings = Manager.setVerbose
    local state = Manager.currentState
    if action and (action == true or settings[action]) or settings[state] then
        if type(settings.output) == 'function' then
            settings.output(rtn)
        else
            error('Verbose set for: '..state..' but output can not be called')
        end
    end
end

--- Main logic for allowing verbose at different stages though out the script
-- @usage Manager.setVerbose{output=log}
-- @tparam newTbl table the table that will be searched for settings to be updated
Manager.setVerbose = setmetatable(
    {
        selfInit=true, -- called while the manager is being set up
        moduleLoad=false, -- when a module is required by the manager
        moduleInit=false, -- when and within the initation of a module
        moduleEnv=false, -- during module runtime, this is a global option set within each module for fine control
        eventRegistered=false, -- when a module registers its event handlers
        errorCaught=true, -- when an error is caught during runtime
        output=Manager._verbose-- can be: print || log || or other function
        _output={} -- a constant value that can used to store output data
    },
    {
        __call=function(tbl,newTbl)
            for key,value in pairs(newTbl) do
                if rawget(tbl,key) ~= nil then
                    Manager.verbose('Verbose for: "'..key..'" has been set to: '..tostring(value))
                    rawset(tbl,key,value)
                end
            end
        end,
        __newindex=function(tbl,key,value)
            if rawget(tbl,key) ~= nil and type(rawget(tbl,key)) == type(value) then rawset(tbl,key,value) end
        end,
        __index=function(tbl,key)
            return rawget(tbl,key) or false
        end,
        __tostring=function(tbl)
            local rtn = ''
            for key,value in pairs(tbl) do
                if type(value) == 'boolean' then
                    rtn=rtn..key..': '..tostring(value)..', '
                end
            end
            return rtn:sub(1,-3)
        end
    }
)
-- call to verbose to show start up
Manager.verbose('Current state is now: "selfInit"; The verbose state is: '..tostring(Manager.setVerbose.selfInit),true)

Manager.sandbox = setmetatable({
    -- can not use existing keys of _G
    verbose=Manager.verbose,
    module_exports=false
},{
    __metatable=false,
    __call=function(tbl,callback,...)
        if type(callback) == 'function' then 
            -- creates a new sandbox env
            local sandbox = tbl()
            -- new indexs are saved into sandbox and if _G does not have the index then look in sandbox
            setmetatable(_G,{
                __index=sandbox,
                __newindex=function(tbl,key,value) rawset(sandbox,key,value) end
            })
            -- runs the callback
            local rtn = {pcall(callback,...)}
            -- resets the global metatable to avoid conflict
            setmetatable(_G,{})
            return sandbox, table.remove(rtn,1), rtn
        else return setmetatable({},{__index=tbl}) end
    end
})

Manager.loadModules = setmetatable({},
    {
        __call=function(tbl)
            -- ReadOnlyManager used to trigger verbose change
            ReadOnlyManager.currentState = 'moduleLoad'
            -- goes though the index looking for modules
            for module_name,location in pairs (moduleIndex) do
                Manager.verbose('Loading module: "'..module_name..'"; Location: '..location)
                -- runs the module in a sandbox env
                local sandbox, success, module = Manager.sandbox(require,location)
                -- extracts the module into global
                if success then
                    local globals = ''
                    for key,value in pairs(sandbox) do globals = globals..key..', ' end
                    if globals ~= '' then Manager.verbose('Globals caught: '..globals:sub(1,-3),'errorCaught') end
                    Manager.verbose('Successfully loaded: "'..module_name..'"; Location: '..location)
                    -- sets that it has been loaded and makes in global under module name
                    if sandbox.module_exports and type(sandbox.module_exports) == 'table' 
                    then tbl[module_name] = sandbox.module_exports
                    else tbl[module_name] = table.remove(module,1) end
                    rawset(_G,module_name,tbl[module_name])
                else
                    Manager.verbose('Failed load: "'..module_name..'"; Location: '..location..' ('..table.remove(module,1)..')','errorCaught')
                end
            end
            ReadOnlyManager.currentState = 'moduleInit'
            -- runs though all loaded modules looking for on_init function; all other modules have been loaded
            for module_name,data in pairs(tbl) do
                if type(data) == 'table' and data.on_init and type(data.on_init) == 'function' then
                    Manager.verbose('Initiating module: "'..module_name)
                    local success, err = pcall(data.on_init)
                    if success then
                        Manager.verbose('Successfully Initiated: "'..module_name..'"; Location: '..location)
                    else
                        Manager.verbose('Failed Initiation: "'..module_name..'"; Location: '..location..' ('..err..')','errorCaught')
                    end
                    data.on_init = nil
                end
            end
            ReadOnlyManager.currentState = 'moduleEnv'
        end,
        __len=function(tbl)
            local rtn = 0
            for key,value in pairs(tbl) do
                rtn = rtn + 1
            end
            return rtn
        end,
        __tostring=function(tbl)
            local rtn = 'Load Modules: '
            for key,value in pairs(tbl) do
                    rtn=rtn..key..', '
            end
            return rtn:sub(1,-3)
        end
    }
)

return ReadOnlyManager