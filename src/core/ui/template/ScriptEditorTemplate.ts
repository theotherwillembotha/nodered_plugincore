import { Template } from "../../NodeConstructor"
import { SourceUtility } from "../../NodeGenerator";
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";

@TemplateDescription({
    name: "script-editor",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "ScriptEditorTemplate.html",
})
export class ScriptEditorTemplate extends Template {
}
