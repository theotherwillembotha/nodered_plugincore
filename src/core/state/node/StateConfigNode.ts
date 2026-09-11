import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig } from "../../NodeConstructor";
import { StateHandle, StateService } from "../service/StateService";

/**
 * Abstract base for all state provider config nodes.
 *
 * Concrete implementations (e.g. InternalStateConfigNode, ZookeeperStateConfigNode) extend this
 * class, decorate with @NodeDescription + tags: ["StateProvider"], and implement createHandle()
 * to return their backend-specific StateHandle.
 *
 * This class is intentionally NOT decorated with @NodeDescription - it is never registered as a
 * Node-RED node type directly. Only concrete subclasses are registered.
 */
export abstract class StateConfigNode extends ConfigNode<ConfigNodeConfig> {

    constructor(node: Node, config: ConfigNodeConfig) {
        super(node, config);
        StateService.registerFactory(config.id, () => this.createHandle());
    }

    /**
     * Creates a new StateHandle for a consumer node.
     * Called once per consumer that references this config node.
     * Each handle maintains its own subscriber slot, so multiple consumers
     * can independently subscribe and unsubscribe without interfering.
     */
    public abstract createHandle(): StateHandle;
}
