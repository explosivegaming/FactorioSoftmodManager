local function moduleOneCall()
    game.print('mod one')
end

test = 'test'
local testTwo = 'test'
return {
    test=test,
    testCall=moduleOneCall,
    testCallTwo=function() game.print('test') end,
    testTwo=testTwo
}