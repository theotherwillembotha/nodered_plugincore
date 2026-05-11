
import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig, NodeDescriptor } from "../../NodeConstructor"
import { NewLogger, Log, LoggerRegistration, LoggerService, RestLoggerConfig } from "../service/LoggerService"
import { SourceUtility } from "../../NodeGenerator";
import { ApiKeyMechanismType, Level, PlatformType, RestAuthType } from "../service/LoggerServiceTypes";
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";

interface RestLoggerConfigNodeConfig extends ConfigNodeConfig {

    id: string;
    platform: PlatformType;
    level:Level;
    template:string;
    
    rest_url: string;
    rest_auth_type: RestAuthType;
    rest_auth_basic_username:string;
    rest_auth_basic_password:string;
    rest_auth_apikey_mechanism:ApiKeyMechanismType;
    rest_auth_apikey_name:string;
    rest_auth_apikey_value:string;
}

@NodeDescription({
    id:"RestLoggerConfigNode",
    name:"Console Logger",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "RestLoggerConfigNode.html",
    package: "@theotherwillembotha/node-red-plugincore",
    dependencies:[ LoggerService ],
    tags: [ "LoggerType" ]
})
export class RestLoggerConfigNode extends ConfigNode<RestLoggerConfigNodeConfig> {
    
    private _logger!: NewLogger<any>;
    
    constructor(node: Node, config: RestLoggerConfigNodeConfig){
        super(node, config);
        let _this = this;

        // instantiate the logger.
        let loggerConfig:any;

        if(config.platform === PlatformType.rest){
            loggerConfig = {
                id:this.id(),
                type:PlatformType.rest,
                template:config.template,
                level:config.level,
                url: config.rest_url,
                auth_type: config.rest_auth_type,
                auth_basic_username:config.rest_auth_basic_username,
                auth_basic_password:config.rest_auth_basic_password,
                auth_apikey_mechanism:config.rest_auth_apikey_mechanism,
                auth_apikey_name:config.rest_auth_apikey_name,
                auth_apikey_value:config.rest_auth_apikey_value,
            } as RestLoggerConfig;
        }

        this._logger = LoggerService.get(loggerConfig);
    }

    public registerLogger(registration:LoggerRegistration):Log {
        return this._logger.register(registration)
    }
}
