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
local function setModuleName(name)
    _G.module_name = setmetatable({},{
        __index=function(tbl,key) return name end,
        __newindex=function(tbl,key,value) error('Module Name Is Read Only') end
        __tostring=function(tbl) return name end,
        __concat=function(tbl) return name end,
        __eq=function(op1,op2) return name ~= nil end
        __metatable=false,
    })
end

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
            -- this is to allow modules to be access with out the need of using Mangaer[name] also keeps global clean
            setmetatable(_G,{__index=ReadOnlyManager})
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
                setModuleName(_module_name)
                _G.module_location = location
                local sandbox, success, module = Manager.sandbox(require,location)
                setModuleName(nil)
                _G.module_location = nil
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
                else
                    Manager.verbose('Failed load: "'.._module_name..'"; Location: '..location..' ('..table.remove(module,1)..')','errorCaught')
                end
            end
            ReadOnlyManager.currentState = 'moduleInit'
            -- runs though all loaded modules looking for on_init function; all other modules have been loaded
            for _module_name,data in pairs(tbl) do
                if type(data) == 'table' and data.on_init and type(data.on_init) == 'function' then
                    Manager.verbose('Initiating module: "'.._module_name)
                    _setModuleName(_module_name)
                    local success, err = pcall(data.on_init)
                    setModuleName(nil)
                    if success then
                        Manager.verbose('Successfully Initiated: "'.._module_name..'"; Location: '..location)
                    else
                        Manager.verbose('Failed Initiation: "'.._module_name..'"; Location: '..location..' ('..err..')','errorCaught')
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

-- event does work a bit differnt from error, and if event breaks error is the fallback
--- Event handler that modules can use, each module can register one function per event
-- @usage Manager.event[event_name] = callback -- sets the callback for that event
-- @usage Manager.event[event_name] = nil -- clears the callback for that event
-- @usage Manager.event(event_name,callback) -- sets the callback for that event
-- @usage Manager.event[event_name] -- returns the callback for that event or the event id if not registered
-- @usage Manager.event(event_name) -- runs all the call backs for that event
-- @tparam event_name int|string index that referes to an event
-- @tparam callback function the function that will be set for that event
-- @usage Manager.event() -- returns the stop value for the event proccessor, if returned during an event will stop all other callbacks
-- @usage #Manager.event -- returns the number of callbacks that are registered
-- @usage pairs(Manager.events) -- returns event_id,table of callbacks
Manager.event = setmetatable({
    __stop={},
    __events={},
    __event=script.on_event,
    __generate=script.generate_event_name,
    __init=script.on_init,
    __load=script.on_load,
    __config=script.on_configuration_changed,
    events=defines.events
},{
    __metatable=false,
    __call=function(tbl,event_name,new_callback,...)
        if event_name == nil then return rawget(tbl,'__stop') end
        if type(event_name) == 'table' then
            for key,_event_name in pairs(event_name) do tbl(_event_name) end return
        end
        event_name = tonumber(event_name) or tbl.names[event_name]
        if type(new_callback) == 'function' then
            Manager.event[event_name] = new_callback return
        end
        if type(tbl[event_name]) == 'table' then
            for _module_name,callback in pairs(tbl[event_name]) do
                if type(callback) ~= 'function' then error('Invalid Event Callback: "'..event_name..'/'.._module_name..'"') end
                setModuleName(_module_name)
                local success, err = pcall(callback,new_callback,...)
                if not success then Manager.verbose('Event Failed: "'..event_name..'/'.._module_name..'" ('..err..')','errorCaught') error('Event Failed: "'..event_name..'/'.._module_name..'" ('..err..')') end
                if err == rawget(tbl,'__stop') then Manager.verbose('Event Haulted By: "'.._module_name..'"','errorCaught') break end
                setModuleName(nil)
            end
        end
    end,
    __newindex=function(tbl,key,value)
        if type(value) ~= 'function' and type(value) ~= nil then error('Attempted to set a non function value to an event',2) end
        local module_name = module_name or 'FSM'
        key = tonumber(key) or tbl.names[key]
        Manager.verbose('Added Handler: "'..tbl.names[key]..'"','errorCaught')
        if not rawget(rawget(tbl,'__events'),key) then rawset(rawget(tbl,'__events'),key,{}) end
        rawset(rawget(rawget(tbl,'__events'),key),module_name,value)
    end,
    __index=function(tbl,key)
        if module_name then
            return rawget(rawget(tbl,'__events'),key) and rawget(rawget(rawget(tbl,'__events'),key),module_name)
            or rawget(rawget(tbl,'__events'),rawget(tbl,'names')[key]) and rawget(rawget(rawget(tbl,'__events'),rawget(tbl,'names')[key]),module_name) 
            or rawget(tbl,'names')[key]
        else
            return rawget(rawget(tbl,'__events'),key) or rawget(rawget(tbl,'__events'),rawget(tbl,'names')[key]) or rawget(tbl,'names')[key]
        end
    end,
    __len=function(tbl)
        local rtn=0
        for event,callbacks in pairs(tbl) do
            for module,callback in pairs(callbacks) do
                rtn=rtn+1
            end
        end
        return rtn
    end,
    __pairs=function(tbl)
        local function next_pair(tbl,k)
            k, v = next(rawget(tbl,'__events'), k)
            if type(v) == 'table' then return k,v end
        end
        return next_pair, tbl, nil
    end
})
--- Sub set to Manger.event and acts as a coverter between event_name and event_id
-- @usage Manager.event[event_name] -- see above, can not be accessed via Manager.event.names
rawset(Manager.event,'names',setmetatable({},{
    __index=function(tbl,key)
        if type(key) == 'number' or tonumber(key) then
            if rawget(tbl,key) then return rawget(tbl,key) end
            if key == 'on_init' or key == 'init' then
                rawset(tbl,key,-1)
            elseif key == 'on_load' or key == 'load' then
                rawset(tbl,key,-2)
            elseif key == 'on_configuration_changed' or key == 'configuration_changed' then
                rawset(tbl,key,-3)
            else
                for event,id in pairs(rawget(Manager.event,'events')) do
                    if id == key then rawset(tbl,key,event) end
                end
            end
            return rawget(tbl,key)
        else return rawget(rawget(Manager.event,'events'),key) end
    end
}))

return ReadOnlyManager