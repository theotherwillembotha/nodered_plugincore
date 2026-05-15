import { Template, TemplateDescriptor } from "../../NodeConstructor"
import { SourceUtility } from "../../NodeGenerator";

export class ScriptEditorTemplate extends Template {

    public static getTemplateDescriptor(): TemplateDescriptor {
        return new TemplateDescriptor(
            "script-editor",
            ScriptEditorTemplate,
            SourceUtility.getSourcePath("/build/", "/src/") + "ScriptEditorTemplate.html",
            []
        );
    }
}
