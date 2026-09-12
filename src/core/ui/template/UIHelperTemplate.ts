import { Template } from "../../NodeConstructor"
import { SourceUtility } from "../../NodeGenerator";
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";

@TemplateDescription({
    name: "ui-helper",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "UIHelperTemplate.html",
})
export class UIHelperTemplate extends Template {
}
