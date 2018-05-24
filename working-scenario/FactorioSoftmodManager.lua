-- Used to load all other modules that are indexed in index.lua
local Manager = {}
local moduleIndex = require("/modules/index")

Manager.currentState = 'selfInit'

--- Setup of the verbose and verbose settings
Manager._verbose = function(rtn) 
    if print then print(rtn) end
    if log then log(rtn) end
    if rcon then rcon.print(rtn) end
end
Manager.verbose = function(rtn)
    local settings = Manager.setVerbose
    local state = Manager.currentState
    if settings[state] then
        if type(settings.output) == 'function' then
            settings.output(rtn)
        else
            error('Verbose set for: '..state..' but output can not be called')
        end
    end
end
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
            for key,value in pairs(Manager._verbose) do
                if settings[key] then
                    Manager.verbose('Verbose for: "'..key..'" has been set to: '..tostring(value))
                    Manager._verbose[key]=value
                end
            end
        end,
        __newindex=function(tbl,key,value)
            if not tbl[key] then return
            else rawset(tbl,key,value) end
        end,
        __index=function(tbl,key)
            if not tbl[key] then return false
            else return rawget(tbl,key) end
        end
        __tostring=function(tbl)
            local rtn = ''
            for key,value in pairs(tbl) do
                if type(value) == 'boolean' then
                    rtn=rtn..key..': '..value..', '
                end
            return rtn:sub(1,-2)
        end
    }
)

return Manager