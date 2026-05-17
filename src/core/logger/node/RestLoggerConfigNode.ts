
import { Node } from "node-red";
import {ConfigNodeConfig } from "../../NodeConstructor"
import { LoggerService, LoggerConfigNode, AbstractLogger, BaseLoggerConfig, TagMap, Log } from "../service/LoggerService"
import { SourceUtility } from "../../NodeGenerator";
import { ApiKeyMechanismType, Level, RestAuthType } from "../service/LoggerService";
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";
import { LoggerTemplateConfig } from "../template/LoggerTemplate";
import { parseURL, URLRecord } from "whatwg-url";
import { HttpTransportOptions } from "winston/lib/winston/transports";
import { createLogger, format, transports, Logger } from "winston";

interface RestLoggerConfigNodeConfig extends ConfigNodeConfig {

    id: string;
    level:Level;
    template:string;
    
    rest_url: string;
    rest_ignoresslerror:boolean;
    rest_auth_type: RestAuthType;
    rest_auth_basic_username:string;
    rest_auth_basic_password:string;
    rest_auth_apikey_mechanism:ApiKeyMechanismType;
    rest_auth_apikey_name:string;
    rest_auth_apikey_value:string;
}

@NodeDescription({
    id:"RestLoggerConfigNode",
    name:"Rest Endpoint Logger",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "RestLoggerConfigNode.html",
    package: "@theotherwillembotha/node-red-plugincore",
    dependencies:[ LoggerService ],
    tags: [ "LoggerType" ]
})
export class RestLoggerConfigNode extends LoggerConfigNode<RestLoggerConfigNodeConfig, RestLogger> {
    
    private _logger!: RestLogger;
    
    constructor(node: Node, config: RestLoggerConfigNodeConfig){
        super(node, config);
        let _this = this;

        // instantiate the logger.
        let loggerConfig:RestLoggerConfig = {
            id:this.id(),
            type:"REST",
            level:config.level,
            template:config.template,
            
            // additional properties.
            url: config.rest_url,
            ignoresslerror:config.rest_ignoresslerror,
            auth_type: config.rest_auth_type,
            auth_basic_username:config.rest_auth_basic_username,
            auth_basic_password:config.rest_auth_basic_password,
            auth_apikey_mechanism:config.rest_auth_apikey_mechanism,
            auth_apikey_name:config.rest_auth_apikey_name,
            auth_apikey_value:config.rest_auth_apikey_value,
        };

        this._logger = new RestLogger(loggerConfig);
    }

    protected logger():RestLogger{
        return this._logger;
    }
}

class RestLogger extends AbstractLogger<RestLoggerConfig> {

    private winston:Logger;

    constructor(config:RestLoggerConfig){
        super(config);

        // get the url.
        let hosturl:URLRecord|null = parseURL(config.url);
        if(!hosturl){
            throw Error("could not parse url: " + config.url);
        }

        // get the options
        let httpOptions:{[key:string]:any} = {}
        
        // get the params.
        let httpParams:HttpTransportOptions = {
            host:hosturl.host?.toString(),
            path:"/" + (hosturl.path ? [...hosturl.path].join("/") : "") + (hosturl.query ? ("?" + hosturl.query) : ""),
            port:(hosturl.port) ? hosturl.port : undefined,
            ssl:hosturl.scheme.toLowerCase() === "https",
            headers: {},
        };        
        (httpParams as any).options = httpOptions;

        // add the ignore ssl error flag if need be.
        if(config.ignoresslerror){
            httpOptions.rejectUnauthorized = false;
        }

        // configure "none" authentication.
        if(config.auth_type === RestAuthType.none){}


        // configure "basic" authentication.
        if(config.auth_type === RestAuthType.basic){
            httpParams.auth = {
                username: config.auth_basic_username,
                password: config.auth_basic_password
            }
        }

        // configure "apikey" authentication.
        if(config.auth_type === RestAuthType.apikey){
            if(config.auth_apikey_mechanism === ApiKeyMechanismType.header) {
                (httpParams.headers as any)[config.auth_apikey_name] = config.auth_apikey_value;
            }
            if(config.auth_apikey_mechanism === ApiKeyMechanismType.matrixparam) {
                httpParams.path = httpParams.path?.replace(`:${config.auth_apikey_name}`, config.auth_apikey_value);
            }
            if(config.auth_apikey_mechanism === ApiKeyMechanismType.queryparam) {
                httpParams.path = httpParams.path + (httpParams.path?.includes("?") ? "&" : "?") + config.auth_apikey_name + "=" + config.auth_apikey_value;
            }
        };

        this.winston = createLogger({
            level: config.level.toString().toLowerCase(),
            format: format.json(),
            defaultMeta: {},
            transports: [
                new transports.Http(httpParams),
            ],
        });
    }

    protected createLogger(config: LoggerTemplateConfig): Log {
        return new RestAppender(config, this.winston);
    }
}

class RestAppender extends Log {
    private winston: Logger;

    constructor(config:LoggerTemplateConfig, winston:Logger){
        super(config);
        this.winston = winston;
    }

    protected writeToLog(level:string, message: string, tags: { [key: string]: string | boolean | number; }): void {
        this.winston.log({
            level:level,
            message:message, 
            labels:tags
        });
    }

}

interface RestLoggerConfig extends BaseLoggerConfig {
    url: string;
    ignoresslerror:boolean;
    auth_type: RestAuthType;
    auth_basic_username:string;
    auth_basic_password:string;
    auth_apikey_mechanism:ApiKeyMechanismType;
    auth_apikey_name:string;
    auth_apikey_value:string;
}