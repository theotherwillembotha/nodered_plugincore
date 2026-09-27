import { SourceUtility } from "../../NodeGenerator";
import { BaseNodeConfig, Template } from "../../NodeConstructor";
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";
import { BasicTemplate } from "../../other/template/BasicTemplate";
import { DelegatedConfigReferenceNode } from "../../other/node/DelegatedConfigReferenceNode";
import { InternalStateConfigNode } from "../node/InternalStateConfigNode";
import { StateService } from "../service/StateService";

export interface StateTemplateConfig extends BaseNodeConfig {
    stateReference: string;
    providerConfig: any;
}

@TemplateDescription({
    name: "state",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "StateTemplate.html",
    dependencies: [BasicTemplate, DelegatedConfigReferenceNode, InternalStateConfigNode, StateService],
})
export class StateTemplate extends Template {
}
