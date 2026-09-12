import { SourceUtility } from "../../NodeGenerator";
import { BaseNodeConfig, Template } from "../../NodeConstructor"
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";
import { DelegatedConfigReferenceNode } from "../../other/node/DelegatedConfigReferenceNode";
import { LoggerService } from "../service/LoggerService";

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

@TemplateDescription({
    name: "logger",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "LoggerTemplate.html",
    dependencies: [DelegatedConfigReferenceNode, LoggerService],
})
export class LoggerTemplate extends Template {
}
