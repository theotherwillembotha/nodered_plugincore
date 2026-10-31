
import * as os from 'os';
import {BaseService, ConfigNodeConfig, ConfigNode } from "../../NodeConstructor";
import { ServiceDescription } from "../../tagging/ServiceDescriptionDecorator";
import { NodeAPI, NodeAPISettingsWithData, Node } from "node-red";
import { LoggerTemplate, LoggerTemplateConfig } from "../template/LoggerTemplate";
import { TemplatingService } from "../../templating/service/TemplatingService";

function getLocalIpAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] ?? []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
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

    protected config():LoggerTemplateConfig{
        return this._config;
    }

    public log(payload:{[key:string]:any}|string):void{
        try{
            let message: string;
            if (payload instanceof String || typeof payload === 'string') {
                message = payload as string;
            } else {
                const provider = TemplatingService.get(
                    this._config.logTemplateProvider || 'HandlebarsTemplatingProvider'
                );
                message = provider.evaluate(this._templateStr, { msg: payload });
            }
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

    // Backed by a global so the value is shared across separately-bundled copies
    // of plugincore (Nodes.js and Plugins.js each inline their own copy).
    public static get instanceID(): string {
        return (global as any).__plugincore_instance_id__ ?? '';
    }
    public static set instanceID(value: string) {
        (global as any).__plugincore_instance_id__ = value;
    }

    private red!: NodeAPI<NodeAPISettingsWithData>;

    constructor(){
        super("logger")
    }

    public init(red: NodeAPI<NodeAPISettingsWithData>): void | Promise<void> {
        this.red = red;
        LoggerService.instanceID = getLocalIpAddress();
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
        super({flow:"",id:"", level:"", name:"", template:"", type:"", logTemplateProvider:"HandlebarsTemplatingProvider"});
    }

    public log(payload:{[key:string]:any}|string):void{
        // do nothing.
    }

    protected writeToLog(level:string, message: string, tags: { [key: string]: string | boolean | number; }): void {
        // do nothing.
    }
}