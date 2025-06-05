// LOGGER is officially deprecated. Do not use it.
import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig, NodeDescriptor } from "../../NodeConstructor"
import { NewLogger, Log, LoggerRegistration, LoggerService, RestLoggerConfig } from "../service/LoggerService"
import { SourceUtility } from "../../NodeGenerator";
import { ApiKeyMechanismType, Level, PlatformType, RestAuthType } from "../service/LoggerServiceTypes";

interface LoggerConfigNodeConfig extends ConfigNodeConfig {

    id: string;
    platform: PlatformType;
    level:Level;
    platfrom:PlatformType;
    template:string;
    
    platform_rest_url: string;
    platform_rest_auth_type: RestAuthType;
    platform_rest_auth_basic_username:string;
    platform_rest_auth_basic_password:string;
    platform_rest_auth_apikey_mechanism:ApiKeyMechanismType;
    platform_rest_auth_apikey_name:string;
    platform_rest_auth_apikey_value:string;

    platform_loki_host:string,
    platform_loki_userid?:string,
    platform_loki_authtoken?:string,
    platform_loki_tenantID?:string
}

export class LoggerConfigNode extends ConfigNode<LoggerConfigNodeConfig> {
    
    private _logger!: NewLogger<any>;
    
    constructor(node: Node, config: LoggerConfigNodeConfig){
        super(node, config);
        let _this = this;

        // instantiate the logger.
        let loggerConfig:any;

        if(config.platform === PlatformType.console){
            loggerConfig = {
                id:this.id(),
                type:PlatformType.console,
                template:config.template,
                level:config.level,
            }
        }

        if(config.platform === PlatformType.rest){
            loggerConfig = {
                id:this.id(),
                type:PlatformType.rest,
                template:config.template,
                level:config.level,
                url: config.platform_rest_url,
                auth_type: config.platform_rest_auth_type,
                auth_basic_username:config.platform_rest_auth_basic_username,
                auth_basic_password:config.platform_rest_auth_basic_password,
                auth_apikey_mechanism:config.platform_rest_auth_apikey_mechanism,
                auth_apikey_name:config.platform_rest_auth_apikey_name,
                auth_apikey_value:config.platform_rest_auth_apikey_value,
            } as RestLoggerConfig;
        }

        if(config.platform === PlatformType.loki){
            loggerConfig = {
                id:this.id(),
                type:PlatformType.loki,
                template:config.template,
                level:config.level,
                host:config.platform_loki_host,
                userid:config.platform_loki_userid,
                authtoken:config.platform_loki_authtoken,
                tenantID:config.platform_loki_tenantID,
            }
        }

        this._logger = LoggerService.get(loggerConfig);
    }

    public registerLogger(registration:LoggerRegistration):Log {
        return this._logger.register(registration)
    }

    static override getNodeDescriptor():NodeDescriptor {
        return new NodeDescriptor(
            "config", 
            "LoggerConfigNode",
            SourceUtility.getSourcePath("/build/", "/src/") + "LoggerConfigNode.html",
            "@theotherwillembotha/nodered_plugincore")
        .addDependency(LoggerService)
        .addTag("Core")
    }
}
