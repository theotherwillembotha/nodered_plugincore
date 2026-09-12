import { SourceUtility } from "../../NodeGenerator";
import { Template } from "../../NodeConstructor"
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";
import { GaugeMetricConfigNode } from "../node/GaugeMetricConfigNode";

@TemplateDescription({
    name: "gaugemetric",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "GaugeMetricTemplate.html",
    dependencies: [GaugeMetricConfigNode],
})
export class GaugeMetricTemplate extends Template {
}
