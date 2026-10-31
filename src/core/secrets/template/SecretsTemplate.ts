import { SourceUtility } from "../../NodeGenerator";
import { BaseNodeConfig, Template } from "../../NodeConstructor";
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";
import { BasicTemplate } from "../../other/template/BasicTemplate";
import { SecretsService } from "../service/SecretsService";

export interface SecretsTemplateNodeConfig extends BaseNodeConfig {}

@TemplateDescription({
    name: "secrets",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "SecretsTemplate.html",
    dependencies: [BasicTemplate, SecretsService],
})
export class SecretsTemplate extends Template {
}
