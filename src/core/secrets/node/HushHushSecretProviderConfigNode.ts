import { Node } from "node-red";
import { SourceUtility } from "../../NodeGenerator";
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";
import { SecretProviderConfigNode, SecretProviderConfigNodeConfig } from "./SecretProviderConfigNode";
import { SecretsService } from "../service/SecretsService";

export interface HushHushSecretProviderConfigNodeConfig extends SecretProviderConfigNodeConfig {}

/**
 * HushHushSecretProvider — a test/demonstration secrets provider.
 *
 * Resolves every key by reversing its characters. This is intentionally
 * useless as a real secrets backend; its purpose is to exercise the full
 * provider lifecycle: registration, shortcode display, discovery via
 * /secretsservice/instances, and runtime resolution.
 *
 * Example: resolve("password") → "drowssap"
 */
@NodeDescription({
    id: "HushHushSecretProviderConfigNode",
    name: "Hush Hush Secret Provider",
    group: "config",
    sourceFile: SourceUtility.getSourcePath("/build/", "/src/") + "HushHushSecretProviderConfigNode.html",
    package: "@theotherwillembotha/node-red-plugincore",
    dependencies: [SecretsService],
    tags: ["SecretsProvider"]
})
export class HushHushSecretProviderConfigNode extends SecretProviderConfigNode {

    constructor(node: Node, config: HushHushSecretProviderConfigNodeConfig) {
        super(node, config);
    }

    public async resolve(key: string): Promise<string> {
        return key.split('').reverse().join('');
    }
}
