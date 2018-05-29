local function moduleOneCall()
    game.print('mod one')
end
script.on_event('on_console_chat',function(event) verbose(module_name) end) 
verbose(module_location)
verbose(module_name)
module_name='test'
test = 'test_G'
local testTwo = 'test'
return {
    test=test,
    testCall=moduleOneCall,
    testCallTwo=function() game.print('test') end,
    testTwo=testTwo
}