import { SourceUtility } from "../../NodeGenerator";
import { BaseNodeConfig, Template, TemplateDescriptor } from "../../NodeConstructor"

// TODO: we need to prefix logger teplate properties with logtemplate_
export interface LoggerTemplateNodeConfig extends BaseNodeConfig{
    logEnabled:boolean,
    logger:string,
    logTemplateOverrideEnabled:boolean,
    logTemplateOverride:string;
}

export type LoggerTemplateConfig = {
    id:string;
    flow:string;
    type:string;
    name:string;
    template:string;
    level:string;
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
