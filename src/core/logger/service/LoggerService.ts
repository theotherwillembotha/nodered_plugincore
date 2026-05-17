
import {BaseService, ServiceDescriptor, ConfigNodeConfig, ConfigNode } from "../../NodeConstructor";
import { NodeAPI, NodeAPISettingsWithData, Node } from "node-red";
import Handlebars from "handlebars";
import { LoggerTemplate, LoggerTemplateConfig } from "../template/LoggerTemplate";
var network = require('network');

// helper for serializing json objects inside handlebars tags.
// you can then convert it like this: {{{json myobject}}}
Handlebars.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

export enum Level{
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARNING = "WARNING",
    ERROR = "ERROR"
}

export enum RestAuthType {
    none="none",
    basic="basic",
    apikey="apikey",
}

export enum ApiKeyMechanismType {
    header="header",
    queryparam="queryparam",
    matrixparam="matrixparam",
}

export type TagMap = { 
    id: string; 
    node: string; 
    type: string; 
    flow: string; 
    instance: string; 
}

export abstract class Log  {
    private _config: LoggerTemplateConfig;
    private template: HandlebarsTemplateDelegate<any>;
    private tags:TagMap;

    protected constructor(config:LoggerTemplateConfig){
        this._config = config;
        this.template = Handlebars.compile(config.template);
        this.tags = {
            id: config.id,
            node: config.name,
            type: config.type,
            flow: config.flow,
            instance: LoggerService.instanceID
        }
    }

    protected config():LoggerTemplateConfig{
        return this._config;
    }

    public log(payload:{[key:string]:any}|string):void{
        try{
            // step 1. serialize the payload using the template engine.
            let message = (payload instanceof String) ? payload as string : this.template({msg:payload});

            // step 2. write to the log appender.
            this.writeToLog(this.config().level, message, this.tags);
        }
        catch(e){
            console.log(e);
        }
    }
    
    protected abstract writeToLog(level:string, message:string, tags:{[key:string]:string|boolean|number}):void;
}

export type BaseLoggerConfig = {
    id:string;
    type:string;
    level: Level;
    template:string;
}

export abstract class AbstractLogger<BaseLoggerConfig>{
    
    private _config: BaseLoggerConfig;
    private _appenders:{[key:string]:Log} = {};
    
    constructor(config:BaseLoggerConfig){
        this._config = config;
    }

    public config():BaseLoggerConfig{
        return this._config;
    }

    public registerTemplate(config: LoggerTemplateConfig): Log{
        let appender:Log = this._appenders[config.id];
        if(appender){
            return appender;
        }
        
        let _this = this;

        this._appenders[config.id] = appender = this.createLogger(config);
        return appender;
    }

    protected abstract createLogger(config: LoggerTemplateConfig):Log;
}

export class LoggerService extends BaseService {

    public static instanceID:string;
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

export type LoggerConfigNodeConfig = ConfigNodeConfig & BaseLoggerConfig & {}

export abstract class LoggerConfigNode<CNC extends LoggerConfigNodeConfig, LoggerType extends AbstractLogger<BaseLoggerConfig>> extends ConfigNode<CNC> {
    
    protected constructor(node:Node, config: CNC){
        super(node, config);
    }

    protected abstract logger():LoggerType;
    
    public registerTemplate(config: LoggerTemplateConfig): Log {
        return this.logger().registerTemplate(config);
    }
}

export class DoNothingAppender extends Log{

    private static instance:DoNothingAppender = new DoNothingAppender();

    static get(): any {
      return DoNothingAppender.instance;
    }

    private constructor(){
        super({flow:"",id:"", level:"", name:"", template:"", type:""});
    }

    public log(payload:{[key:string]:any}|string):void{
        // do nothing.
    }

    protected writeToLog(level:string, message: string, tags: { [key: string]: string | boolean | number; }): void {
        // do nothing.
    }
}