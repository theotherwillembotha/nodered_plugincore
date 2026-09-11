import { BaseService, FlowDeployment } from "../../NodeConstructor";
import { ServiceDescription } from "../../tagging/ServiceDescriptionDecorator";
import { NodeAPI, NodeAPISettingsWithData } from "node-red";
import * as fs from "fs";
import * as path from "path";

// ******************************************************* //
//                   StateHandle                           //
// ******************************************************* //

export interface StateHandle {
    get(): Promise<string | null>;
    set(stateName: string): Promise<void>;
    subscribe(callback: (stateName: string) => void): void;
    unsubscribe(): void;
}

export class DoNothingStateHandle implements StateHandle {
    public get(): Promise<string | null> { return Promise.resolve(null); }
    public set(_stateName: string): Promise<void> { return Promise.resolve(); }
    public subscribe(_callback: (stateName: string) => void): void {}
    public unsubscribe(): void {}
}

// (StateReference removed - stateEnabled is no longer optional; consumers pass the ID directly)

// ******************************************************* //
//                   Global Store Keys                     //
// ******************************************************* //

const _GLOBAL_STATE_MEMORY_KEY    = '__plugincore_internalstate_memory__';
const _GLOBAL_STATE_SUBS_KEY      = '__plugincore_internalstate_subscribers__';
const _GLOBAL_STATE_FACTORIES_KEY = '__plugincore_state_factories__';
const _GLOBAL_STATE_CONFIG_KEY    = '__plugincore_state_config__';
const _GLOBAL_STATE_USERDIR_KEY   = '__plugincore_state_userDir__';

function getMemoryStore(): Map<string, string> {
    if (!(global as any)[_GLOBAL_STATE_MEMORY_KEY]) (global as any)[_GLOBAL_STATE_MEMORY_KEY] = new Map();
    return (global as any)[_GLOBAL_STATE_MEMORY_KEY];
}

function getSubscriberStore(): Map<string, Set<(s: string) => void>> {
    if (!(global as any)[_GLOBAL_STATE_SUBS_KEY]) (global as any)[_GLOBAL_STATE_SUBS_KEY] = new Map();
    return (global as any)[_GLOBAL_STATE_SUBS_KEY];
}

function getFactoryStore(): Map<string, () => StateHandle> {
    if (!(global as any)[_GLOBAL_STATE_FACTORIES_KEY]) (global as any)[_GLOBAL_STATE_FACTORIES_KEY] = new Map();
    return (global as any)[_GLOBAL_STATE_FACTORIES_KEY];
}

function getConfigStore(): Map<string, { survivesRedeploy: boolean; survivesRestart: boolean }> {
    if (!(global as any)[_GLOBAL_STATE_CONFIG_KEY]) (global as any)[_GLOBAL_STATE_CONFIG_KEY] = new Map();
    return (global as any)[_GLOBAL_STATE_CONFIG_KEY];
}

function getUserDir(): string | undefined {
    return (global as any)[_GLOBAL_STATE_USERDIR_KEY];
}

function stateFilePath(nodeId: string): string | null {
    const userDir = getUserDir();
    if (!userDir) return null;
    return path.join(userDir, 'internalstate', nodeId + '.json');
}

// ******************************************************* //
//                   StateService                          //
// ******************************************************* //

@ServiceDescription({
    id: "@theotherwillembotha/stateservice",
    name: "StateService",
    type: "integration-plugin",
    sourceFile: "@theotherwillembotha/node-red-plugincore",
})
export class StateService extends BaseService {

    constructor() {
        super("StateService");
    }

    public init(red: NodeAPI<NodeAPISettingsWithData>): void {
        (global as any)[_GLOBAL_STATE_USERDIR_KEY] = (red.settings as any).userDir;
    }

    public deinit(_red: NodeAPI<NodeAPISettingsWithData>): void {}

    public async onDeploy(deployment: FlowDeployment): Promise<void> {
        const flowIds = new Set(deployment.flows.map(e => e.id));
        const factories = getFactoryStore();
        const configs = getConfigStore();
        const memory = getMemoryStore();

        // Remove factories for config nodes no longer in the flow.
        factories.forEach((_, nodeId) => {
            if (!flowIds.has(nodeId)) factories.delete(nodeId);
        });

        // Clear memory for state config nodes that are gone or do not survive redeploy.
        configs.forEach((cfg, nodeId) => {
            if (!flowIds.has(nodeId)) {
                memory.delete(nodeId);
                configs.delete(nodeId);
            } else if (!cfg.survivesRedeploy && !cfg.survivesRestart) {
                memory.delete(nodeId);
            }
        });

        return Promise.resolve();
    }

    // ---- Factory registration (called by StateConfigNode subclasses) ----

    public static registerFactory(nodeId: string, factory: () => StateHandle): void {
        getFactoryStore().set(nodeId, factory);
    }

    public static registerConfig(nodeId: string, config: { survivesRedeploy: boolean; survivesRestart: boolean }): void {
        getConfigStore().set(nodeId, config);
    }

    // ---- Handle creation (called by consumer nodes) ----

    public static createHandle(stateReference: string): StateHandle {
        if (!stateReference) return new DoNothingStateHandle();
        const factory = getFactoryStore().get(stateReference);
        return factory ? factory() : new DoNothingStateHandle();
    }

    // ---- Memory store (used by InternalStateHandle) ----

    public static getMemory(nodeId: string): string | null {
        return getMemoryStore().get(nodeId) ?? null;
    }

    public static setMemory(nodeId: string, value: string): void {
        getMemoryStore().set(nodeId, value);
    }

    // ---- File store (used by InternalStateHandle) ----

    public static readFile(nodeId: string): string | null {
        const filePath = stateFilePath(nodeId);
        if (!filePath) return null;
        try {
            if (!fs.existsSync(filePath)) return null;
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content).value ?? null;
        } catch {
            return null;
        }
    }

    public static writeFile(nodeId: string, value: string): void {
        const filePath = stateFilePath(nodeId);
        if (!filePath) return;
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({ value }), 'utf8');
    }

    // ---- Subscriber management (used by InternalStateHandle) ----

    public static addSubscriber(nodeId: string, callback: (s: string) => void): void {
        const store = getSubscriberStore();
        if (!store.has(nodeId)) store.set(nodeId, new Set());
        store.get(nodeId)!.add(callback);
    }

    public static removeSubscriber(nodeId: string, callback: (s: string) => void): void {
        getSubscriberStore().get(nodeId)?.delete(callback);
    }

    public static notifySubscribers(nodeId: string, value: string): void {
        getSubscriberStore().get(nodeId)?.forEach(cb => {
            try { cb(value); } catch {}
        });
    }
}
