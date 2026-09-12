import { SourceUtility } from "../../NodeGenerator";
import { BaseNodeConfig, Template } from "../../NodeConstructor"
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";
import { DelegatedConfigReferenceNode } from "../../other/node/DelegatedConfigReferenceNode";
import { MetricsService } from "../service/MetricsService";
import { MetricsReference } from "../service/MetricsService";

export interface MetricsTemplateConfig extends BaseNodeConfig, MetricsReference {
}

@TemplateDescription({
    name: "metrics",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "MetricsTemplate.html",
    dependencies: [DelegatedConfigReferenceNode, MetricsService],
})
export class MetricsTemplate extends Template {
}
