import { SourceUtility } from "../../NodeGenerator";
import { BaseNodeConfig, Template, TemplateDescriptor } from "../../NodeConstructor"
import { MetricsReference } from "../service/MetricsService";

export interface MetricsTemplateConfig extends BaseNodeConfig, MetricsReference {
}

export class MetricsTemplate extends Template {

    public static getTemplateDescriptor(): TemplateDescriptor {
        return new TemplateDescriptor(
            "metrics",
            MetricsTemplate,
            SourceUtility.getSourcePath("/build/", "/src/") + "MetricsTemplate.html",
            []);
    }
}
