import { SourceUtility } from "../../NodeGenerator";
import { Template } from "../../NodeConstructor"
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";
import { TimerMetricConfigNode } from "../node/TimerMetricConfigNode";

@TemplateDescription({
    name: "timermetric",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "TimerMetricTemplate.html",
    dependencies: [TimerMetricConfigNode],
})
export class TimerMetricTemplate extends Template {
}
