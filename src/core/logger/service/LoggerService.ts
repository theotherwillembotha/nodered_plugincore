
import {BaseService, ConfigNodeConfig, ConfigNode } from "../../NodeConstructor";
import { ServiceDescription } from "../../tagging/ServiceDescriptionDecorator";
import { NodeAPI, NodeAPISettingsWithData, Node } from "node-red";
import { LoggerTemplate, LoggerTemplateConfig } from "../template/LoggerTemplate";

// Build-time / optional runtime deps — lazy so they are never required at bundle load time.
function getHandlebars(): any { return require('handlebars'); }
function getNetwork(): any { return require('network'); }

let _helpersRegistered = false;
function ensureHelpersRegistered(): void {
    if (_helpersRegistered) return;
    _helpersRegistered = true;
    // helper for serializing json objects inside handlebars tags.
    // you can then convert it like this: {{{json myobject}}}
    getHandlebars().registerHelper('json', function(context: any) {
        return JSON.stringify(context);
    });
}

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
    private _templateStr: string;
    private _compiledTemplate: any = null;
    private tags:TagMap;

    protected constructor(config:LoggerTemplateConfig){
        this._config = config;
        this._templateStr = config.template;
        this.tags = {
            id: config.id,
            node: config.name,
            type: config.type,
            flow: config.flow,
            instance: LoggerService.instanceID
        }
    }

    private getTemplate(): any {
        if (!this._compiledTemplate) {
            ensureHelpersRegistered();
            this._compiledTemplate = getHandlebars().compile(this._templateStr);
        }
        return this._compiledTemplate;
    }

    protected config():LoggerTemplateConfig{
        return this._config;
    }

    public log(payload:{[key:string]:any}|string):void{
        try{
            // step 1. serialize the payload using the template engine.
            let message = (payload instanceof String) ? payload as string : this.getTemplate()({msg:payload});

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

@ServiceDescription({
    id: "@theotherwillembotha/loggerservice",
    sourceFile: "@theotherwillembotha/node-red-plugincore",
    dependencies: [LoggerTemplate]
})
export class LoggerService extends BaseService {

    public static instanceID:string;
    private red!: NodeAPI<NodeAPISettingsWithData>;

    constructor(){
        super("logger")
    }

    public init(red: NodeAPI<NodeAPISettingsWithData>): void | Promise<void> {
        this.red = red;

        return new Promise<void>((resolve) => {
            getNetwork().get_active_interface((_err:any, obj:any) => {
                LoggerService.instanceID = obj.ip_address;
            });
        });
    }

    public deinit(red: NodeAPI<NodeAPISettingsWithData>): void | Promise<void> {}

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

    private static _instance: DoNothingAppender | null = null;

    static get(): DoNothingAppender {
        if (!DoNothingAppender._instance) DoNothingAppender._instance = new DoNothingAppender();
        return DoNothingAppender._instance;
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