
import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig } from "../../NodeConstructor"
import { NewLogger, Log, LoggerRegistration, LoggerService } from "../service/LoggerService"
import { SourceUtility } from "../../NodeGenerator";
import { Level, PlatformType } from "../service/LoggerServiceTypes";
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";

interface LokiLoggerConfigNodeConfig extends ConfigNodeConfig {

    id: string;
    level:Level;
    template:string;

    loki_host:string,
    loki_userid?:string,
    loki_authtoken?:string,
    loki_tenantid?:string
}

@NodeDescription({
    id:"LokiLoggerConfigNode",
    name:"Loki Logger",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "LokiLoggerConfigNode.html",
    package: "@theotherwillembotha/node-red-plugincore",
    dependencies:[ LoggerService ],
    tags: [ "LoggerType" ]
})
export class LokiLoggerConfigNode extends ConfigNode<LokiLoggerConfigNodeConfig> {
    
    private _logger!: NewLogger<any>;
    
    constructor(node: Node, config: LokiLoggerConfigNodeConfig){
        super(node, config);
        let _this = this;

        // instantiate the logger.
        let loggerConfig:any;

        loggerConfig = {
            id:this.id(),
            type:PlatformType.loki,
            template:config.template,
            level:config.level,
            host:config.loki_host,
            userid:config.loki_userid,
            authtoken:config.loki_authtoken,
            tenantID:config.loki_tenantid,
        }

        this._logger = LoggerService.get(loggerConfig);
    }

    public registerLogger(registration:LoggerRegistration):Log {
        return this._logger.register(registration)
    }
}
