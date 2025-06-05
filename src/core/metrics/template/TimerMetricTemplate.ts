import { SourceUtility } from "../../NodeGenerator";
import { Template,  TemplateDescriptor } from "../../NodeConstructor"
import { TimerMetricConfigNode } from "../node/TimerMetricConfigNode";

export class TimerMetricTemplate extends Template {
    
    public static getTemplateDescriptor(): TemplateDescriptor {
        return new TemplateDescriptor(
            "timermetric",
            TimerMetricTemplate, 
            SourceUtility.getSourcePath("/build/", "/src/") + "TimerMetricTemplate.html",
            [TimerMetricConfigNode]);
    }
}