/**
 * NodeManagerRuntime.ts
 *
 * STANDALONE - zero imports from the rest of plugincore.
 *
 * This file is compiled and copied into every plugin's build output so that
 * plugins are self-contained and do not require plugincore to be separately
 * installed in the user's Node-RED environment.
 *
 * When multiple plugins are deployed, each ships its own copy of this file.
 * The first plugin to load registers its NodeManager and nodes; subsequent
 * copies operate independently on their own node types with no conflict.
 *
 * POST_CONSTRUCT_KEY is intentionally a plain string (not a Symbol) so that
 * the decorators (from plugincore's NodeConstructor, loaded via the plugin's
 * dependency on plugincore) and this runtime file (a separate module instance)
 * resolve to the same property key on node instances.
 */

import type { NodeAPI, NodeAPISettingsWithData } from "node-red";

// ─── API version ────────────────────────────────────────────────────────────
// Semver of the NodeManager API contract - independent of plugincore's package
// version. Bump when the contract changes; plugins can read this to warn users
// that they were built against a different NodeManager version.
export const NODEMANAGER_API_VERSION = "1.0.0";

// ─── Shared key for post-construct initializer lists ────────────────────────
// Must be a plain string so it resolves identically across module instances.
export const POST_CONSTRUCT_KEY = '__plugincore_postConstructInitializers__';

// ─── Minimal types ───────────────────────────────────────────────────────────

export interface BaseNodeConfig {
    id: string;
    name: string;
    type: string;
}

interface INodeDescriptor {
    id(): string;
    tags(): string[];
}

interface INodeClass {
    new(node: any, config: any): any;
    getNodeDescriptor(): INodeDescriptor;
}

// ─── Post-construct initializer runner ───────────────────────────────────────

export function runPostConstructInitializers(instance: any): void {
    const initializers: Function[] = instance[POST_CONSTRUCT_KEY];
    if (!initializers || initializers.length === 0) return;

    const className = instance.constructor.name;
    initializers.forEach((init, index) => {
        try {
            init(instance);
        } catch (error) {
            console.error(
                `Post-construct initialization failed:\n` +
                `  Class: ${className}\n` +
                `  Initializer: ${index + 1}/${initializers.length}\n` +
                `  Error: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    });

    delete instance[POST_CONSTRUCT_KEY];
}

// ─── NodeManager ─────────────────────────────────────────────────────────────
// RED is stored on `global` rather than as a static class field so that all
// module instances of NodeManagerRuntime (the local copy bundled into Nodes.js
// and the copy bundled via plugincore's NodeConstructor) share the same value.
// Without this, esbuild's two separate inline copies would have independent
// static fields and the one used by decorators would never see RED being set.
const _GLOBAL_RED_KEY = '__plugincore_NodeManager_RED__';

// ─── Global node-type registration guard ─────────────────────────────────────
// When multiple self-contained plugins are installed they each bundle plugincore
// inline and each try to call RED.nodes.registerType for the same shared
// infrastructure node types (ConsoleLoggerConfigNode, RestLoggerConfigNode, etc.).
// Node-RED rejects duplicate registrations with a warning and the second
// plugin's Nodes.js fails to load. This global set tracks which types have
// already been registered so subsequent plugins silently skip them.
const _GLOBAL_REGISTERED_NODES_KEY = '__plugincore_registered_nodes__';

function getRegisteredNodes(): Set<string> {
    if (!(global as any)[_GLOBAL_REGISTERED_NODES_KEY]) {
        (global as any)[_GLOBAL_REGISTERED_NODES_KEY] = new Set<string>();
    }
    return (global as any)[_GLOBAL_REGISTERED_NODES_KEY];
}

export class NodeManager {

    // nodeTypeService is resolved dynamically via RED.plugins - no static import needed.
    private nodeTypeService: any;
    private typeBacklog: INodeClass[] = [];

    public constructor(RED: NodeAPI<NodeAPISettingsWithData>) {
        (global as any)[_GLOBAL_RED_KEY] = RED;

        const nodeTypeServiceId = "@theotherwillembotha/nodetypeservice";

        const nodeTypeServiceListener = (pluginID: string) => {
            if (pluginID === nodeTypeServiceId) {
                RED.events.off('plugin.instantiated', nodeTypeServiceListener);
                this.nodeTypeService = (RED.plugins.get(nodeTypeServiceId) as any).instance;

                for (const nodeType of this.typeBacklog) {
                    for (const tag of nodeType.getNodeDescriptor().tags()) {
                        this.nodeTypeService.registerNodeType(tag, nodeType);
                    }
                }
                this.typeBacklog = [];
            }
        };

        this.nodeTypeService = (RED.plugins.get(nodeTypeServiceId) as any)?.instance;
        if (!this.nodeTypeService) {
            RED.events.on('plugin.instantiated', nodeTypeServiceListener);
        }
    }

    public static get RED(): NodeAPI<NodeAPISettingsWithData> {
        return (global as any)[_GLOBAL_RED_KEY];
    }

    public registerNodeType(typeName: string, type: INodeClass): NodeManager {
        if (!type) {
            console.error(
                `[NodeManager v${NODEMANAGER_API_VERSION}] Type "${typeName}" is undefined. ` +
                `Ensure it is exported and included in GenerateNodes.`
            );
            return this;
        }

        const registeredNodes = getRegisteredNodes();
        if (registeredNodes.has(typeName)) {
            // Already registered by another plugin - skip to avoid Node-RED duplicate-registration error.
            return this;
        }
        registeredNodes.add(typeName);

        const nodeConstructor = function(this: any, config: any) {
            try {
                NodeManager.RED.nodes.createNode(this, config);
                const node = new (type as any)(this, config);
                runPostConstructInitializers(node);
                if (node.onInit) {
                    node.onInit();
                }
            } catch (error) {
                console.error(`[NodeManager v${NODEMANAGER_API_VERSION}] Failed to construct node "${typeName}":`, error);
            }
        };

        try {
            NodeManager.RED.nodes.registerType(typeName, nodeConstructor, { settings: {} });

            const nodeDescription = type.getNodeDescriptor();
            if (this.nodeTypeService) {
                for (const tag of nodeDescription.tags()) {
                    this.nodeTypeService.registerNodeType(tag, type);
                }
            } else {
                this.typeBacklog.push(type);
            }
        } catch (error) {
            console.error(`[NodeManager v${NODEMANAGER_API_VERSION}] Failed to register node type "${typeName}":`, error);
        }

        return this;
    }
}
