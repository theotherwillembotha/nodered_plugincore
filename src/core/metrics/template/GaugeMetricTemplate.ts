import { SourceUtility } from "../../NodeGenerator";
import { Template,  TemplateDescriptor } from "../../NodeConstructor"
import { GaugeMetricConfigNode } from "../node/GaugeMetricConfigNode";

export class GaugeMetricTemplate extends Template {

    
    public static getTemplateDescriptor(): TemplateDescriptor {
        return new TemplateDescriptor(
            "gaugemetric",
            GaugeMetricTemplate, 
            SourceUtility.getSourcePath("/build/", "/src/") + "GaugeMetricTemplate.html",
            [GaugeMetricConfigNode]);
    }
}