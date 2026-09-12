import { SourceUtility } from "../../NodeGenerator";
import { BaseNodeConfig, Template } from "../../NodeConstructor";
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";
import { DelegatedConfigReferenceNode } from "../../other/node/DelegatedConfigReferenceNode";
import { InternalStateConfigNode } from "../node/InternalStateConfigNode";
import { StateService } from "../service/StateService";

export interface StateTemplateConfig extends BaseNodeConfig {
    stateReference: string;
}

@TemplateDescription({
    name: "state",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "StateTemplate.html",
    dependencies: [DelegatedConfigReferenceNode, InternalStateConfigNode, StateService],
})
export class StateTemplate extends Template {
}
