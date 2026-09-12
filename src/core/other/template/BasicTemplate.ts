import { Template } from "../../NodeConstructor"
import { SourceUtility } from "../../NodeGenerator";
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";

@TemplateDescription({
    name: "basic",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "BasicTemplate.html",
})
export class BasicTemplate extends Template {
}
