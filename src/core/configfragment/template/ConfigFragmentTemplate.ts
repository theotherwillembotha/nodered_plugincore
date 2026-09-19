import { SourceUtility } from "../../NodeGenerator";
import { Template } from "../../NodeConstructor";
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";
import { ConfigFragmentService } from "../service/ConfigFragmentService";

@TemplateDescription({
    name: "configfragment",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "ConfigFragmentTemplate.html",
    dependencies: [ConfigFragmentService],
})
export class ConfigFragmentTemplate extends Template {
}
