import { SourceUtility } from "../../NodeGenerator";
import { BaseNodeConfig, Template, TemplateDescriptor } from "../../NodeConstructor"

export interface LoggerTemplateConfig extends BaseNodeConfig{
    logEnabled:boolean,
    logger:string,
    logTemplateOverrideEnabled:boolean,
    logTemplateOverride:string;
}

export class LoggerTemplate extends Template {

    
    static getTemplateDescriptor(): TemplateDescriptor {
        return new TemplateDescriptor(
            "logger", 
            LoggerTemplate, 
            SourceUtility.getSourcePath("/build/", "/src/") + "LoggerTemplate.html",
            [], 
        )
    }
}
