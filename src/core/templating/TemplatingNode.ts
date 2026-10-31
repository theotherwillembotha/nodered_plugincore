import { Node } from "node-red";
import { BaseNode, BaseNodeConfig, NodeManager } from "../NodeConstructor";
import { SourceUtility, Message } from "../NodeGenerator";
import { onInput } from "../other/InputDecorator";
import { NodeDescription } from "../tagging/NodeDescriptionDecorator";
import { TemplatingTemplate, TemplatingTemplateNodeConfig } from "./template/TemplatingTemplate";
import { BasicTemplate } from "../other/template/BasicTemplate";
import { TemplatingService } from "./service/TemplatingService";

export interface TemplatingNodeConfig extends BaseNodeConfig, TemplatingTemplateNodeConfig {
    outputOverwrite: boolean;
    outputProperty: string;
    parseJson: boolean;
}

@NodeDescription({
    id: "TemplatingNode",
    name: "Templating Node",
    group: "plugincore",
    sourceFile: SourceUtility.getSourcePath("/build/", "/src/") + "TemplatingNode.html",
    package: "@theotherwillembotha/node-red-plugincore",
    dependencies: [],
    templates: [
        { template: BasicTemplate, config: {} },
        { template: TemplatingTemplate, config: {} },
    ],
    tags: []
})
export class TemplatingNode extends BaseNode<TemplatingNodeConfig> {

    constructor(node: Node, config: TemplatingNodeConfig) {
        super(node, config);
    }

    @onInput()
    protected async messageReceived(message: Message): Promise<void> {
        const config = this.config();
        const provider = TemplatingService.get(config.templatingProvider);

        const raw = provider.evaluate(config.templateContent || '', message as object);

        let result: any = raw;
        if (config.parseJson !== false) {
            try { result = JSON.parse(raw); } catch (_) { /* not JSON — keep string */ }
        }

        if (config.outputOverwrite) {
            if (result === null || typeof result !== 'object' || Array.isArray(result)) {
                this.node().error(
                    `TemplatingNode: "Overwrite entire message" requires the template to produce a JSON object, but got ${Array.isArray(result) ? 'array' : typeof result}. Disable "Overwrite entire message" or fix the template.`,
                    message
                );
                return;
            }
            this.node().send(result as Message);
        } else {
            const path = config.outputProperty || 'payload';
            NodeManager.RED.util.setMessageProperty(message, path, result);
            this.node().send(message);
        }
    }
}
