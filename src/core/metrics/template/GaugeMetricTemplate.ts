import { SourceUtility } from "../../NodeGenerator";
import { BaseNodeConfig, Template } from "../../NodeConstructor"
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";
import { BasicTemplate } from "../../other/template/BasicTemplate";
import { MetricsService, MetricsReference } from "../service/MetricsService";
import { DelegatedConfigReferenceNode } from "../../other/node/DelegatedConfigReferenceNode";
export interface GaugeMetricTemplateConfig extends BaseNodeConfig, MetricsReference {
    resetOnDeploy: boolean;
    providerConfig: any;
}

@TemplateDescription({
    name: "gaugemetric",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "GaugeMetricTemplate.html",
    dependencies: [BasicTemplate, DelegatedConfigReferenceNode, MetricsService],
})
export class GaugeMetricTemplate extends Template {
}
