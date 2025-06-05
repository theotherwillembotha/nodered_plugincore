import { SourceUtility } from "../../NodeGenerator";
import { Template,  TemplateDescriptor } from "../../NodeConstructor"
import { CounterMetricConfigNode } from "../node/CounterMetricConfigNode";

export class CounterMetricTemplate extends Template {

    
    public static getTemplateDescriptor(): TemplateDescriptor {
        return new TemplateDescriptor(
            "countermetric", 
            CounterMetricTemplate, 
            SourceUtility.getSourcePath("/build/", "/src/") + "CounterMetricTemplate.html",
            [CounterMetricConfigNode]);
    }
}