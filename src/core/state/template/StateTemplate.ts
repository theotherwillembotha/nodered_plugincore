import { SourceUtility } from "../../NodeGenerator";
import { BaseNodeConfig, Template, TemplateDescriptor } from "../../NodeConstructor";

export interface StateTemplateConfig extends BaseNodeConfig {
    stateReference: string;
}

export class StateTemplate extends Template {

    public static getTemplateDescriptor(): TemplateDescriptor {
        return new TemplateDescriptor(
            "state",
            StateTemplate,
            SourceUtility.getSourcePath("/build/", "/src/") + "StateTemplate.html",
            []);
    }
}
