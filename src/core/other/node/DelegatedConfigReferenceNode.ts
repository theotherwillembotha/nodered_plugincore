
/**
 * DelegatedConfigReferenceNode — a framework-internal sentinel type.
 *
 * PROBLEM
 * Node-RED's reference counter (the usage count shown on config nodes in the
 * Config sidebar) is driven by `updateConfigNodeUsers()` in nodes.js. That
 * function only tracks a property as a config-node reference when two conditions
 * are met:
 *   1. `defaults[property].type` is set to a registered node type name.
 *   2. That node type's `category` equals `"config"`.
 *
 * When a node property can reference *any* of several config-node types (e.g.
 * ConsoleLoggerConfigNode, RestLoggerConfigNode, LokiLoggerConfigNode, or a
 * future third-party logger), there is no single concrete type to declare.
 * Leaving `type` blank causes the counter to stay at zero even when references
 * exist, and the config node is incorrectly flagged as unused.
 *
 * WORKAROUND
 * Register this no-op node with `category: "config"` so that its type name can
 * be used as the `type` value in `addDefault(...)` calls where the referenced
 * config node type is not known ahead of time (open/delegated reference).
 * `updateConfigNodeUsers` will then pass both gates, look up the config node by
 * its actual runtime ID, and correctly increment the counter.
 *
 * USAGE
 * In a template or node's onCompose section, declare the property like this:
 *
 *   .addDefault("myProp", { value: '', required: false, type: "DelegatedConfigReferenceNode" })
 *
 * Because the property name intentionally does NOT match the `node-input-X` /
 * `node-config-input-X` naming convention, Node-RED will NOT auto-initialise
 * the form element or auto-save the value. You must therefore:
 *   - Read  the stored value manually in `onIncludeEditPrepare`
 *             e.g. $("#my-selector").val(node.myProp);
 *   - Write it back manually in `onIncludeEditSave`
 *             e.g. node.myProp = $("#my-selector").val();
 *
 * LONG-TERM
 * A proper fix would be a Node-RED PR to make `updateConfigNodeUsers` use the
 * already-parsed `_type.types` array (set by `parseNodePropertyTypeString`) so
 * that pipe-separated multi-type strings such as
 * "ConsoleLoggerConfigNode|RestLoggerConfigNode" work natively.
 * Until that PR is accepted, this sentinel type is the recommended workaround
 * within this framework.
 *
 * NOTE: This node has no UI, no edit form, and no runtime behaviour. It cannot
 * be instantiated by users and should never appear as a flow node.
 */

import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig } from "../../NodeConstructor"
import { SourceUtility } from "../../NodeGenerator";
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";

interface DelegatedConfigReferenceNodeConfig extends ConfigNodeConfig {}

@NodeDescription({
    id:"DelegatedConfigReferenceNode",
    name:"DelegatedConfigReferenceNode",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "DelegatedConfigReferenceNode.html",
    package: "@theotherwillembotha/node-red-plugincore",
})
export class DelegatedConfigReferenceNode extends ConfigNode<DelegatedConfigReferenceNodeConfig> {
    
    constructor(node: Node, config: DelegatedConfigReferenceNodeConfig){
        super(node, config);
    }
}
