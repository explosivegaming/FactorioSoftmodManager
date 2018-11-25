--- Desction <get from json>
-- @module ThisModule@X.Y.Z
-- @author <get from json>
-- @license <get from json>
-- @alais ThisModule 

-- Module Require
local Module = require('Module')
local SubModule = require('Collection.Submodule')
local OptModule -- OptModule@^X.Y.Z

-- Local Varibles

-- Module Define
local module_verbose = false
local ThisModule = {
    on_init=function()
        if loaded_modules['OptModule'] then OptModule = require('OptModule') end
        --code
    end,
    on_post=function()
        --code
    end
}

-- Global Define
local global = global{
    key='value'
}

-- Function Define
local function bar()
    return 'bar'
end

function ThisModule.foo() 
    return 'foo'
end

-- Event Handlers Define
script.on_event(defines.events.on_player_joined_game,function(event)
    game.print(game.players[event.player_index].name..' joined the game!!!')
end)

-- Module Return
return ThisModule 