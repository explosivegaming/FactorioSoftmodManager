-- Used to load all other modules that are indexed in index.lua
local Manager = {}
local moduleIndex = require("/modules/index")

Manager.currentState = 'selfInit'

---- Setup of the verbose and verbose settings

--- Default output for the verbose
-- @usage Manager.verbose('Hello, World!')
-- @tparm rtn string the value that will be returned though verbose output
Manager._verbose = function(rtn) 
    if print then print(rtn) end
    if _log then _log(rtn) end -- _log is a call to first line of control.lua to shorten log lines
end

--- Used to call the output of the verbose when the current state allows it
-- @usage Manager.verbose('Hello, World!')
-- @tparm rtn string the value that will be returned though verbose output
-- @tparm force boolean when set verbose will always return a value
Manager.verbose = function(rtn,force)
    local settings = Manager.setVerbose
    local state = Manager.currentState
    if force or settings[state] then
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
        moduleRequire=false, -- when a module is required by the manager
        moduleInit=false, -- when and within the initation of a module
        moduleEnv=false, -- during module runtime, this is a global option set within each module for fine control
        eventRegistered=false, -- when a module registers its event handlers
        errorCaught=true, -- when an error is caught during runtime
        output=Manager._verbose-- can be: print || log || or other function
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

Manager.loadModdules = setmetatable({},
    {
        __call=function(...)
            return {...}
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
                if type(value) == 'boolean' then
                    rtn=rtn..key..', '
                end
            end
            return rtn:sub(1,-3)
        end
    }
)

--- Setup for metatable of the Manager to force read only nature
-- @usage Manager() -- runs Manager.loadModdules()
setmetatable(Manager,{
    __call=function(tbl)
        if #Manager.loadModdules == 0 then
            Manager.loadModdules()
        end
    end,
    __newindex=function(tbl,key,value)
        if key ~= 'currentState' then error('Manager is read only please use included methods')
        else Manager.verbose('Current state is now: "'..value.. '"; The new verbose state is: '..tostring(Manager.setVerbose[value]),true) rawset(tbl,key,value) end
    end,
    __tostring=function(tbl)
        return tostring(Manager.loadModdules)
    end
})
return Manager