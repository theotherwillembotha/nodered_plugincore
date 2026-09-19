import * as path from 'path';
import { Template } from "../../NodeConstructor"
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";

// Resolves from build/ (not src/) because inline-resources.js generates
// a self-contained HTML with the editorLanguageExtension.js inlined.
@TemplateDescription({
    name: "script-editor",
    templateFile: path.join(__dirname, "ScriptEditorTemplate.html"),
})
export class ScriptEditorTemplate extends Template {
}
