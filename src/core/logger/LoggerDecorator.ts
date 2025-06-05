import { BaseNode, NodeManager } from "../NodeConstructor";
import { Log, LoggerRegistration } from "./service/LoggerService";
import { LoggerTemplateConfig } from "./template/LoggerTemplate";


export function Logger(debug?:string):Function {

  return function (target: any, propertyKey: string | symbol) {

    // if the type is a string, then its probably defined in the local (core) module.
    if(typeof propertyKey ===  "string"){
      const valueSymbol = Symbol(`_${String(propertyKey)}_value`);
      
      Object.defineProperty(target, propertyKey, {
        get: function() {
          
          if(!this[valueSymbol]){
              let node = this as BaseNode<LoggerTemplateConfig>;
              //console.log("setting logger on node " + node.name() + " (localized)");
              let config = node.config();
              let logger;

              if(config.logEnabled){
                let registration:LoggerRegistration = {
                  id:config.id,
                  flow:node.flow(),
                  type:node.type(),
                  name:node.name(),
                  enabled:config.logEnabled,
                  override:config.logTemplateOverrideEnabled,
                  template:config.logTemplateOverride
                };
              
                // get a reference to the loggerService.
                try{
                  logger = (NodeManager.RED.nodes.getNode(config.logger) as any).node().registerLogger(registration) as Log;
                }
                catch(e){
                  console.log("failed getting logger ", config.logger, e);
                  logger = { log(){} };
                }
              }
              else{
                logger = { log(){} };
              }

              this[valueSymbol] = logger;
          }
          return this[valueSymbol];
        },
        enumerable: true,
        configurable: false
      });
      return;
    }
    else{
      let property = propertyKey as any;
      //property.addInitializer(() => {
      property.addInitializer(function(this:BaseNode<LoggerTemplateConfig>){
        let node = this as BaseNode<LoggerTemplateConfig>
        const valueSymbol = Symbol(`_${String(property.name)}_value`);
        Object.defineProperty(node, property.name, {
          get: function() {
            
            if(!this[valueSymbol]){
                //console.log("setting logger on node " + node.name()+ " (externalized)");
                let config = node.config();
                let logger;

                if(config.logEnabled){
                  let registration:LoggerRegistration = {
                    id:config.id,
                    flow:node.flow(),
                    type:node.type(),
                    name:node.name(),
                    enabled:config.logEnabled,
                    override:config.logTemplateOverrideEnabled,
                    template:config.logTemplateOverride
                  };
                
                  // get a reference to the loggerService.
                  try{
                    logger = (NodeManager.RED.nodes.getNode(config.logger) as any).node().registerLogger(registration) as Log;
                  }
                  catch(e){
                    console.log("failed getting logger ", config.logger, e);
                    logger = { log(){} };
                  }
                }
                else{
                  logger = { log(){} };
                }

                this[valueSymbol] = logger;
            }
            return this[valueSymbol];
          },
          enumerable: true,
          configurable: false
        });
      })
      return;
    }
  };
}