-- Used to load all other modules that are indexed in index.lua
local moduleIndex = require("/modules/index")
local Manager = {}
--- Setup for metatable of the Manager to force read only nature
-- @usage Manager() -- runs Manager.loadModdules()
-- @usage Manager[name] -- returns module by that name
-- @usage tostring(Manager) -- returns formated list of loaded modules
local ReadOnlyManager = setmetatable({},{
    __metatable=false,
    __index=function(tbl,key)
        return rawget(Manager,key) ~= nil and rawget(Manager,key) or rawget(Manager.loadModules,key)
    end,
    __call=function(tbl)
        if #tbl.loadModules == 0 then
            tbl.loadModules()
        end
    end,
    __newindex=function(tbl,key,value)
        if key == 'currentState' then
            Manager.verbose('Current state is now: "'..value.. '"; The verbose state is now: '..tostring(Manager.setVerbose[value]),true) 
            rawset(Manager,key,value)
        else error('Manager is read only please use included methods',2)  end
    end,
    __tostring=function(tbl)
        return tostring(Manager.loadModules)
    end
})


Manager.currentState = 'selfInit'
-- selfInit > moduleLoad > moduleInit > moduleEnv

--- Default output for the verbose
-- @usage Manager.verbose('Hello, World!')
-- @tparm rtn string the value that will be returned though verbose output
Manager._verbose = function(rtn)
    if game and Manager.setVerbose._output ~= true then Manager.setVerbose._output=true game.write_file('verbose.log',rtn)
    elseif game then game.write_file('verbose.log','\n'..rtn,true) end
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
    if module_name then rtn='['..module_name..'] '..rtn 
    else rtn='[FSM] '..rtn end
    if module_verbose or action and (action == true or settings[action]) or settings[state] then
        if type(settings.output) == 'function' then
            settings.output(rtn)
        else
            error('Verbose set for: '..state..' but output can not be called',2)
        end
    end
end

--- Main logic for allowing verbose at different stages though out the script
-- @usage Manager.setVerbose{output=log}
-- @tparam newTbl table the table that will be searched for settings to be updated
-- @usage Manager.setVerbose[setting] -- returns the value of that setting
-- @usage tostring(Manager.setVerbose) -- returns a formated list of the current settings
Manager.setVerbose = setmetatable(
    {
        selfInit=true, -- called while the manager is being set up
        moduleLoad=false, -- when a module is required by the manager
        moduleInit=false, -- when and within the initation of a module
        moduleEnv=false, -- during module runtime, this is a global option set within each module(module_verbose=true ln:1) for fine control
        eventRegistered=false, -- when a module registers its event handlers
        errorCaught=true, -- when an error is caught during runtime
        output=Manager._verbose, -- can be: print || log || or other function
        _output={} -- a constant value that can used to store output data
    },
    {
        __metatable=false,
        __call=function(tbl,newTbl)
            for key,value in pairs(newTbl) do
                if rawget(tbl,key) ~= nil then
                    Manager.verbose('Verbose for: "'..key..'" has been set to: '..tostring(value))
                    rawset(tbl,key,value)
                end
            end
        end,
        __newindex=function(tbl,key,value)
            error('New settings cannot be added during runtime',2)
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

--- Creates a sand box envorment and runs a callback in that sand box; provents global pollution
-- @usage Manager.sandbox(callback) -- return sandbox, success, other returns from callback
-- @tparam callback function the function that will be ran in the sandbox
-- @param[opt] any other params that the function will use
-- @usage Manager.sandbox() -- returns and empty sandbox
-- @usage Manager.sandbox[key] -- returns the sand box value in that key
Manager.sandbox = setmetatable({
    -- can not use existing keys of _G
    verbose=Manager.verbose,
    module_verbose=false,
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

--- Loads the modules that are present in the index list
-- @usage Manager.loadModules() -- loads all moddules in the index list
-- @usage #Manager.loadModules -- returns the number of modules loaded
-- @usage tostring(Manager.loadModules) -- returns a formatted list of all modules loaded
-- @usage pairs(Manager.loadModules) -- loops over the loaded modules moduleName, module
Manager.loadModules = setmetatable({},
    {
        __metatable=false,
        __call=function(tbl)
            -- ReadOnlyManager used to trigger verbose change
            ReadOnlyManager.currentState = 'moduleLoad'
            -- goes though the index looking for modules
            for _module_name,location in pairs (moduleIndex) do
                Manager.verbose('Loading module: "'.._module_name..'"; Location: '..location)
                -- runs the module in a sandbox env
                _G.module_name = _module_name
                local sandbox, success, module = Manager.sandbox(require,location)
                _G.module_name = nil
                -- extracts the module into global
                if success then
                    local globals = ''
                    for key,value in pairs(sandbox) do globals = globals..key..', ' end
                    if globals ~= '' then Manager.verbose('Globals caught in "'.._module_name..'": '..globals:sub(1,-3),'errorCaught') end
                    Manager.verbose('Successfully loaded: "'.._module_name..'"; Location: '..location)
                    -- sets that it has been loaded and makes in global under module name
                    if sandbox.module_exports and type(sandbox.module_exports) == 'table' 
                    then tbl[_module_name] = sandbox.module_exports
                    else tbl[_module_name] = table.remove(module,1) end
                    rawset(_G,_module_name,tbl[_module_name])
                else
                    Manager.verbose('Failed load: "'.._module_name..'"; Location: '..location..' ('..table.remove(module,1)..')','errorCaught')
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

--- A more detailed replacement for the lua error function to allow for handlers to be added; repleaces default error so error can be used instead of Manager.error
-- @usage Manager.error(err) -- calls all error handlers that are set or if none then prints to game and if that fails crashs game
-- @tparam err string the err string that will be passed to the handlers
-- @usage Manager.error() -- returns an error constant that can be used to crash game
-- @usage Manager.error(Manager.error()) -- crashs the game
-- @usage Manager.error.addHandler(name,callback) -- adds a new handler if handler returns Manager.error() then game will crash
-- @tparam name string || fucntion the name that is given to the callback || the callback that will be used
-- @tparam[opt:type(name)=='function'] callback function if name is given as a string this will be the callback used
-- @usage Manager.error[name] -- returns the handler of that name if present
-- @usage #Manager.error -- returns the number of error handlers that are present
-- @usage pairs(Manager.error) -- loops over only the error handlers handler_name,hander
Manager.error = setmetatable({
    __error_call=error,
    __error_const={},
    __error_handler=function(handler_name,callback)
        if type(handler_name) == 'string' and type(callback) == 'function' then Manager.error[handler_name]=callback
        elseif type(handler_name) == 'function' then table.insert(Manager.error,handler_name)
        else Manager.error('Handler is not a function',2) end
    end
},{
    __metatalbe=false,
    __call=function(tbl,err,...)
        if err == nil then return rawget(tbl,'__error_const') end
        if err == rawget(tbl,'__error_const') then Manager.verbose('Force Stop','errorCaught') rawget(tbl,'__error_call')('Force Stop',2) end
        if #tbl > 0 then
            for handler_name,callback in pairs(tbl) do
                local success, err = pcall(callback,err,...)
                if not success then Manager.verbose('Error handler: "'..handler_name..'" failed to run ('..err..')','errorCaught') end
                if err == rawget(tbl,'__error_const') then Manager.verbose('Force Stop by: '..handler_name,'errorCaught') rawget(tbl,'__error_call')('Force Stop by: '..handler_name) end
            end
        elseif game then
            Manager.verbose('No error handlers loaded; Default game print used','errorCaught')
            game.print(err)
        else
            Manager.verbose('No error handlers loaded; Game not loaded; Forced crash: '..err,'errorCaught')
            rawget(tbl,'__error_call')(err,2)
        end
    end,
    __index=function(tbl,key)
        if key:lower() == 'addhandler' or key:lower() == 'sethandler' or key:lower() == 'handler' then return rawget(tbl,'__error_handler')
        elseif key == '__error_call' or key == '__error_const' or key == '__error_handler' then tbl(key..' can not be indexed please use build in methods',2)
        else return rawget(tbl,key) end
    end,
    __newindex=function(tbl,key,value)
        if type(value) == 'function' then 
            Manager.verbose('Added Error Handler: "'..key..'"','eventRegistered')
            rawset(tbl,key,value)
        end
    end,
    __len=function(tbl)
        local rtn=0
        for handler_name,callback in pairs(tbl) do
            rtn=rtn+1
        end
        return rtn
    end,
    __pairs=function(tbl)
        local function next_pair(tbl,k)
            local v
            k, v = next(tbl, k)
            if k == '__error_call' or k == '__error_const' or k == '__error_handler' then return next_pair(tbl,k) end
            if type(v) == 'function' then return k,v end
        end
        return next_pair, tbl, nil
    end
})
-- overrides the default error function
error=Manager.error

return ReadOnlyManager