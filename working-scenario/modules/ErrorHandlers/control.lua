error.addHandler('RuntimePrint',function(err)
    game.print('Runtime Error: '..err)
end)

error.addHandler('ThisHanlderFailsToRun',function(err)
    game.print(Runtime..err)
end)

return {
    addCrash=function()
        error.addHandler('ThisOneCrashsTheGame',function(err)
            return error()
        end)
    end
}