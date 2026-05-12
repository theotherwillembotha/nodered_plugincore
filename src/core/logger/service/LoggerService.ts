
import {BaseService, ServiceDescriptor } from "../../NodeConstructor";
import { NodeAPI, NodeAPISettingsWithData } from "node-red";
import Handlebars from "handlebars";
import { createLogger, format, transports } from "winston";
import LokiTransport from "winston-loki";
import { URLRecord, parseURL } from 'whatwg-url';
import { LoggerTemplate } from "../template/LoggerTemplate";
var network = require('network');
import deepEqual from "deep-equal";
import { HttpTransportOptions } from "winston/lib/winston/transports";
import { ApiKeyMechanismType, Level, PlatformType, RestAuthType } from "./LoggerServiceTypes";

// helper for serializing json objects inside handlebars tags.
// you can then convert it like this: {{{json myobject}}}
Handlebars.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

type TagMap = { 
    instance: string; 
    flow: string; 
    node: string; 
    type: string; 
    id: string; 
}

export type Log = {
    log(message:{[key:string]:any}|string):void;
}

export class LogImplementation implements Log {
    
    private root: NewLogger<any>; 
    private config:LoggerRegistration;
    private template?:HandlebarsTemplateDelegate<any>;
    private tagMap:TagMap;
    
    constructor(root:NewLogger<any>, config:LoggerRegistration){
        this.root = root;
        this.config = config;
        this.template = (config.override && config.template) ? Handlebars.compile(config.template) : undefined;
        this.tagMap = {
            instance:LoggerService.instanceID,
            flow:config.flow,
            node:config.name,
            type:config.type,
            id:config.id,
        };
    }

    public log(message:{[key:string]:any}|string){
        // enrich the logged content with additional properties.
        let content = {
            currentTime: new Date().toISOString(),
            msg: message,
        }

        // send typ the logger.
        this.root.log(this, content);
    }

    public serialize(content:{[key:string]:any}) {
        return !!this.template ? this.template(content) : this.root.serialize(content);
    }

    public getTags() {
        return this.tagMap;
    }
}

export interface BaseLoggerConfig {
    id:string;
    type:PlatformType;
    level: Level;
    template:string;
}

export abstract class NewLogger<ConfigType extends BaseLoggerConfig> {
    private _config: ConfigType;
    private template: HandlebarsTemplateDelegate<string>;

    constructor(config:ConfigType){
        this._config = config;
        this.template = Handlebars.compile(config.template);
    }

    public log(reference:LogImplementation, content:{[key:string]:any}) {
        try{
            // step 1, attempt to serialize the content.
            let serializedContent = reference.serialize(content);

            // step 2, get the tags.
            let tags = reference.getTags();

            // step 3. write to the logger.
            this.writeToLog(serializedContent, tags);
        }
        catch(exception){
            console.log((exception as any).message);
        }
    }

    public register(registration:LoggerRegistration):Log{
        return new LogImplementation(this, registration);
    }

    public serialize(content: any) {
        return this.template(content);
    }

    public config():ConfigType {
        return this._config;
    }

    protected abstract writeToLog(serializedContent: string, tags: TagMap):void;
}

export interface ConsoleLoggerConfig extends BaseLoggerConfig  {

}

class ConsoleLogger extends NewLogger<ConsoleLoggerConfig> {

    constructor(config:ConsoleLoggerConfig){
        super(config);
    }

    protected writeToLog(serializedContent: string, tags: TagMap): void {
        console.log(tags, serializedContent);
    } 
}

export interface LokiLoggerConfig extends BaseLoggerConfig{
    type:PlatformType.loki;
    host:string;
    userid?:string;
    authtoken?:string;
    tenantid?:string;
}

class LokiLogger extends NewLogger<LokiLoggerConfig>{
    logger: any;

    constructor(config:LokiLoggerConfig){
        super(config);
        
        let transportConfig = {
            host: config.host,
            json: true,
            format: format.json(),
            headers: {
                "X-Scope-OrgID": (config.tenantid) ? config.tenantid : undefined
            },
            replaceTimestamp: true,
            onConnectionError: (err:unknown) => console.error(err),
            basicAuth: (config.userid && config.authtoken) 
                ? `${config.userid}:${config.authtoken}`
                : undefined
        }

        this.logger = createLogger({
            level: this.config().level.toString().toLowerCase(),
            format: format.json(),
            defaultMeta: {},
            transports: [
              new LokiTransport(transportConfig),
            ],
        });
    }

    protected writeToLog(serializedContent: string, tags: TagMap): void {
        this.logger.log({message:serializedContent, level:this.logger.level, labels:tags});
    }
}

export interface RestLoggerConfig extends BaseLoggerConfig{
    type:PlatformType.rest;
    url: string;
    ignoresslerror:boolean;
    auth_type: RestAuthType;
    auth_basic_username:string;
    auth_basic_password:string;
    auth_apikey_mechanism:ApiKeyMechanismType;
    auth_apikey_name:string;
    auth_apikey_value:string;
}

class RestLogger extends NewLogger<RestLoggerConfig>{
    logger: any;

    constructor(config:RestLoggerConfig){
        super(config);

        let hosturl:URLRecord|null = parseURL(config.url);
    
        if(!hosturl){
            throw Error("could not parse url: " + config.url);
        }

        let httpOptions:{[key:string]:any} = {}

        let httpParams:HttpTransportOptions = {
            host:hosturl.host?.toString(),
            path:"/" + (hosturl.path ? [...hosturl.path].join("/") : "") + (hosturl.query ? ("?" + hosturl.query) : ""),
            port:(hosturl.port) ? hosturl.port : undefined,
            ssl:hosturl.scheme.toLowerCase() === "https",
            headers: {},
        };
        (httpParams as any).options = httpOptions;

        if(config.ignoresslerror){
            httpOptions.rejectUnauthorized = false;
        }

        if(config.auth_type === RestAuthType.none){}

        if(config.auth_type === RestAuthType.basic){
            httpParams.auth = {
                username: config.auth_basic_username,
                password: config.auth_basic_password
            }
        }
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

        this.logger = createLogger({
            level: config.level.toString().toLowerCase(),
            format: format.json(),
            defaultMeta: {},
            transports: [
                new transports.Http(httpParams),
            ],
        });
    }

    protected writeToLog(serializedContent: string, tags: TagMap): void {
        this.logger.log({level:this.logger.level, message:serializedContent, labels:tags});
    }
}

let LoggerTypes:{[key:string]:any} = {
    console: ConsoleLogger,
    loki: LokiLogger,
    rest: RestLogger
}

export class LoggerService extends BaseService {

    public static instanceID:string;

    private static loggers:{[key:string]:NewLogger<BaseLoggerConfig>} = {};
    private red!: NodeAPI<NodeAPISettingsWithData>;

    constructor(){
        super("logger")
    }

    public init(red: NodeAPI<NodeAPISettingsWithData>): void | Promise<void> {
        this.red = red;

        return new Promise<void>((resolve) => {
            network.get_active_interface((err:any, obj:any) => {
                LoggerService.instanceID = obj.ip_address;
            });
        });
    }

    public deinit(red: NodeAPI<NodeAPISettingsWithData>): void | Promise<void> {}

    public static get <ConfigType extends BaseLoggerConfig>(config:ConfigType): NewLogger<ConfigType>{

        let logger:NewLogger<ConfigType>  = this.loggers[config.id] as NewLogger<ConfigType>;

        if(logger){
            if(!deepEqual(config, logger.config())){
                this.loggers[config.id] = (logger = new (LoggerTypes[config.type])(config));
            }
        }
        else{
            this.loggers[config.id] = (logger = new (LoggerTypes[config.type])(config));
        }

        return logger;
    }

    static override getServiceDescriptor():ServiceDescriptor {
        return new ServiceDescriptor(
            "@theotherwillembotha/loggerservice",
            "LoggerService",
            "services-plugin",
            "@theotherwillembotha/node-red-plugincore",
            LoggerService,
            [LoggerTemplate]
        );
    }
}

export type LoggerRegistration = {
    id:string;
    flow:string;
    type:string;
    name:string;
    enabled:boolean;
    template?:string;
    override?:boolean;
}
