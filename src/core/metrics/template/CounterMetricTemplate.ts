import { SourceUtility } from "../../NodeGenerator";
import { Template } from "../../NodeConstructor"
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";
import { CounterMetricConfigNode } from "../node/CounterMetricConfigNode";

@TemplateDescription({
    name: "countermetric",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "CounterMetricTemplate.html",
    dependencies: [CounterMetricConfigNode],
})
export class CounterMetricTemplate extends Template {
}
