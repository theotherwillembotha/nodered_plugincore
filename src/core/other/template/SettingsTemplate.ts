import { Template } from "../../NodeConstructor"
import { SourceUtility } from "../../NodeGenerator";
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";
import { SettingsService } from "../service/SettingsService";

@TemplateDescription({
    name: "settings",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "SettingsTemplate.html",
    dependencies: [SettingsService],
})
export class SettingsTemplate extends Template {
}
