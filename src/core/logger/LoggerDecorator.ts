import { BaseNode, NodeManager } from "../NodeConstructor";
import { AbstractLogger, Log, BaseLoggerConfig, DoNothingAppender, LoggerConfigNode, LoggerConfigNodeConfig } from "./service/LoggerService";
import { LoggerTemplateConfig, LoggerTemplateNodeConfig } from "./template/LoggerTemplate";

export function Logger(debug?:string):Function {

  return function (target: any, propertyKey: string | symbol) {

    // if the type is a string, then its probably defined in the local (core) module.
    if(typeof propertyKey ===  "string"){
      const valueSymbol = Symbol(`_${String(propertyKey)}_value`);

      //console.log("BINDING:", "target", target, "propertyKey", propertyKey );
      
      Object.defineProperty(target, propertyKey, {
        get: function() {

          //console.log("setting logger on node " + this.name() + " (localized)");
          
          if(!this[valueSymbol]){

              try{
                let node = this as BaseNode<LoggerTemplateNodeConfig>;
                let config = node.config();

                if(!config.logEnabled){
                  return this[valueSymbol] = DoNothingAppender.get();
                }

                // get the logger config node.
                let loggerConfigNode:LoggerConfigNode<LoggerConfigNodeConfig, AbstractLogger<BaseLoggerConfig>> =(NodeManager.RED.nodes.getNode(config.loggerReference) as any).node();

                let loggerTemplateConfig:LoggerTemplateConfig = {
                  id:config.id,
                  flow:node.flow(),
                  type:node.type(),
                  name:node.name(),
                  level:loggerConfigNode.config().level,
                  template: (config.logTemplateOverrideEnabled) ? config.logTemplateOverride : loggerConfigNode.config().template,
                };

                // get a reference to the loggerService.
                return this[valueSymbol] = loggerConfigNode.registerTemplate(loggerTemplateConfig);
              }
              catch(e){
                console.log(`failed getting logger "${this?.config()?.logger}"`, e);
                return this[valueSymbol] = DoNothingAppender.get();
              }
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

      property.addInitializer(function(this:BaseNode<LoggerTemplateNodeConfig>){
        let node = this as BaseNode<LoggerTemplateNodeConfig>
        const valueSymbol = Symbol(`_${String(property.name)}_value`);

        //console.log("ADDING INITIALIZER:", "node", node, "property.name", property.name );

        Object.defineProperty(node, property.name, {
          get: function() {

            //console.log("setting logger on node " + node.name()+ " (externalized)");
            
            if(!this[valueSymbol]){
              try{
                let config = node.config();

                if(!config.logEnabled){
                  return this[valueSymbol] = DoNothingAppender.get();
                }

                // get the logger config node.
                let loggerConfigNode:LoggerConfigNode<LoggerConfigNodeConfig, AbstractLogger<BaseLoggerConfig>> =(NodeManager.RED.nodes.getNode(config.loggerReference) as any).node();

                let loggerTemplateConfig:LoggerTemplateConfig = {
                  id:config.id,
                  flow:node.flow(),
                  type:node.type(),
                  name:node.name(),
                  level: loggerConfigNode?.config().level ?? 'info',
                  template: (config.logTemplateOverrideEnabled) ? config.logTemplateOverride : (loggerConfigNode?.config().template ?? 'message:{{msg}}'),
                };

                // get a reference to the loggerService.
                return this[valueSymbol] = loggerConfigNode.registerTemplate(loggerTemplateConfig);
              }
              catch(e){
                console.log("failed getting logger ", e);
                return this[valueSymbol] = DoNothingAppender.get();
              }
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