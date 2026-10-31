import { Node } from "node-red";
import { BaseNode, BaseNodeConfig, NodeManager } from "../NodeConstructor";
import { SourceUtility, Message } from "../NodeGenerator";
import { onInput } from "../other/InputDecorator";
import { NodeDescription } from "../tagging/NodeDescriptionDecorator";
import { BasicTemplate } from "../other/template/BasicTemplate";
import { SecretsTemplate } from "./template/SecretsTemplate";
import { SecretsService } from "./service/SecretsService";

export interface SecretsLookupNodeConfig extends BaseNodeConfig {
    secretKey:        string;
    secretProvider:   string;
    outputProperty:   string;
}

@NodeDescription({
    id: "SecretsLookupNode",
    name: "Secrets Lookup",
    group: "plugincore",
    sourceFile: SourceUtility.getSourcePath("/build/", "/src/") + "SecretsLookupNode.html",
    package: "@theotherwillembotha/node-red-plugincore",
    dependencies: [],
    templates: [
        { template: BasicTemplate,   config: {} },
        { template: SecretsTemplate, config: {} },
    ],
    tags: []
})
export class SecretsLookupNode extends BaseNode<SecretsLookupNodeConfig> {

    constructor(node: Node, config: SecretsLookupNodeConfig) {
        super(node, config);
    }

    @onInput()
    protected async messageReceived(message: Message): Promise<void> {
        const config = this.config();

        const resolved = await SecretsService.resolve(
            config.secretProvider || null,
            config.secretKey || ''
        );

        const path = config.outputProperty || 'payload';
        NodeManager.RED.util.setMessageProperty(message, path, resolved);
        this.node().send(message);
    }
}
