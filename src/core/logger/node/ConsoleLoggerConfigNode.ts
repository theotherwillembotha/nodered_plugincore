
import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig } from "../../NodeConstructor"
import { NewLogger, Log, LoggerRegistration, LoggerService } from "../service/LoggerService"
import { SourceUtility } from "../../NodeGenerator";
import { Level, PlatformType } from "../service/LoggerServiceTypes";
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";

interface ConsoleLoggerConfigNodeConfig extends ConfigNodeConfig {
    id: string;
    level:Level;
    template:string;
}

@NodeDescription({
    id:"ConsoleLoggerConfigNode",
    name:"Console Logger",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "ConsoleLoggerConfigNode.html",
    package: "@theotherwillembotha/nodered_plugincore",
    dependencies:[ LoggerService ],
    tags: [ "LoggerType" ]
})
export class ConsoleLoggerConfigNode extends ConfigNode<ConsoleLoggerConfigNodeConfig> {
    
    private _logger!: NewLogger<any>;
    
    constructor(node: Node, config: ConsoleLoggerConfigNodeConfig){
        super(node, config);
        let _this = this;

        // instantiate the logger.
        let loggerConfig = {
            id:this.id(),
            type:PlatformType.console,
            template:config.template,
            level:config.level,
        }

        this._logger = LoggerService.get(loggerConfig);
    }

    public registerLogger(registration:LoggerRegistration):Log {
        return this._logger.register(registration)
    }
}
