import { SourceUtility } from "../../NodeGenerator";
import { BaseNodeConfig, Template } from "../../NodeConstructor"
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";
import { BasicTemplate } from "../../other/template/BasicTemplate";
import { MetricsService, MetricsReference } from "../service/MetricsService";
import { DelegatedConfigReferenceNode } from "../../other/node/DelegatedConfigReferenceNode";
export interface CounterMetricTemplateConfig extends BaseNodeConfig, MetricsReference {
    resetOnDeploy: boolean;
    providerConfig: any;
}

@TemplateDescription({
    name: "countermetric",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "CounterMetricTemplate.html",
    dependencies: [BasicTemplate, DelegatedConfigReferenceNode, MetricsService],
})
export class CounterMetricTemplate extends Template {
}
