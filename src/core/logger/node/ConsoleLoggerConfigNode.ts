
import { Node } from "node-red";
import { LoggerService, LoggerConfigNodeConfig, BaseLoggerConfig, AbstractLogger, TagMap, LoggerConfigNode, Log, Level } from "../service/LoggerService"
import { SourceUtility } from "../../NodeGenerator";
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";
import { LoggerTemplateConfig } from "../template/LoggerTemplate";

interface ConsoleLoggerConfigNodeConfig extends LoggerConfigNodeConfig {
    level:Level;
    template:string;
}

@NodeDescription({
    id:"ConsoleLoggerConfigNode",
    name:"Console Logger",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "ConsoleLoggerConfigNode.html",
    package: "@theotherwillembotha/node-red-plugincore",
    dependencies:[ LoggerService ],
    tags: [ "LoggerType" ]
})
export class ConsoleLoggerConfigNode extends LoggerConfigNode<ConsoleLoggerConfigNodeConfig, ConsoleLogger> {
    
    private _logger!: ConsoleLogger;
    
    constructor(node: Node, config: ConsoleLoggerConfigNodeConfig){
        super(node, config);
        let _this = this;

        // create logger config
        let loggerConfig:ConsoleLoggerConfig = {
            id:this.id(),
            type:"CONSOLE",
            level:config.level,
            template:config.template,
        }

        // create logger instance:
        this._logger = new ConsoleLogger(loggerConfig);
    }

    protected logger():ConsoleLogger{
        return this._logger;
    }
}

export interface ConsoleLoggerConfig extends BaseLoggerConfig  {
    // no additional values.
}

class ConsoleLogger extends AbstractLogger<ConsoleLoggerConfig> {

    constructor(config:ConsoleLoggerConfig){
        super(config);
    }

    protected createLogger(config: LoggerTemplateConfig): Log {
        return new ConsoleAppender(config);
    }
}

class ConsoleAppender extends Log {

    constructor(config:LoggerTemplateConfig){
        super(config);
    }

    protected writeToLog(level:string, message: string, tags: { [key: string]: string | boolean | number; }): void {
        console.log(new Date().toISOString(), this.config().id, level, tags, message)
    }
}