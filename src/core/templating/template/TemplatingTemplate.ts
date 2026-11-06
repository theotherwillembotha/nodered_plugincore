import { SourceUtility } from "../../NodeGenerator";
import { BaseNodeConfig, Template } from "../../NodeConstructor";
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";
import { BasicTemplate } from "../../other/template/BasicTemplate";
import { TemplatingService } from "../service/TemplatingService";

export interface TemplatingTemplateNodeConfig extends BaseNodeConfig {
    templatingProvider: string;
    templateContent: string;
}

@TemplateDescription({
    name: "templating",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "TemplatingTemplate.html",
    dependencies: [BasicTemplate, TemplatingService],
})
export class TemplatingTemplate extends Template {
}
