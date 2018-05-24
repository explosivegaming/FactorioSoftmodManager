-- File Which Factorio Will Call
Manager = require("FactorioSoftmodManager")
Manager.setVerbose{
    selfInit=true, -- called while the manager is being set up
    moduleLoad=true, -- when a module is required by the manager
    moduleInit=true, -- when and within the initation of a module
    moduleEnv=true, -- during module runtime, this is a global option set within each module for fine control
    eventRegistered=true, -- when a module registers its event handlers
    errorCaught=true, -- when an error is caught during runtime
    output=Manager._verbose -- can be: can be: print || log || other function
}
Manager.loadModules()