import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig } from "../../NodeConstructor";
import { SecretsProvider, SecretsService } from "../service/SecretsService";

export interface SecretProviderConfigNodeConfig extends ConfigNodeConfig {
    shortcode: string;
}

/**
 * Abstract base for all secret provider config nodes.
 *
 * Concrete implementations (e.g. OpenBaoSecretProviderConfigNode) extend this
 * class, decorate with @NodeDescription + tags: ["SecretsProvider"], and implement
 * resolve() to perform the actual secret lookup against their backend.
 *
 * Instances register themselves globally with SecretsService on construction
 * and unregister on close. Because registration is global, any node that holds
 * a stored instance ID can resolve secrets without holding a direct reference
 * to the config node.
 *
 * This class is intentionally NOT decorated with @NodeDescription — it is never
 * registered as a Node-RED node type directly. Only concrete subclasses are
 * registered.
 */
export abstract class SecretProviderConfigNode
    extends ConfigNode<SecretProviderConfigNodeConfig>
    implements SecretsProvider {

    constructor(node: Node, config: SecretProviderConfigNodeConfig) {
        super(node, config);

        SecretsService.registerInstance(
            {
                id:        config.id,
                shortcode: config.shortcode,
                type:      (config as any).type ?? '',
                name:      config.name,
            },
            this
        );

        node.on('close', (_removed: boolean, done: () => void) => {
            SecretsService.unregisterInstance(config.id);
            done();
        });
    }

    public abstract resolve(key: string): Promise<string>;
}
