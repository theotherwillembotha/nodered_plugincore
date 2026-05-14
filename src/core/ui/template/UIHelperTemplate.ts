import { Template, TemplateDescriptor } from "../../NodeConstructor"
import { SourceUtility } from "../../NodeGenerator";

export class UIHelperTemplate extends Template {

    public static getTemplateDescriptor(): TemplateDescriptor {
        return new TemplateDescriptor(
            "ui-helper",
            UIHelperTemplate,
            SourceUtility.getSourcePath("/build/", "/src/") + "UIHelperTemplate.html",
            []
        );
    }
}
