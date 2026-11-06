import { BaseService } from "../../NodeConstructor";
import { ServiceDescription } from "../../tagging/ServiceDescriptionDecorator";
import { NodeAPI, NodeAPISettingsWithData } from "node-red";

// ---------------------------------------------------------------------------
// Public interface — what every secrets backend must implement
// ---------------------------------------------------------------------------

export interface SecretsProvider {
    resolve(key: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// Built-in NullSecretsProvider — the value IS the secret (no external lookup)
// ---------------------------------------------------------------------------

export class NullSecretsProvider implements SecretsProvider {
    public static readonly ID = "__null__";
    public static readonly SHORTCODE = "local";

    public async resolve(key: string): Promise<string> {
        return key;
    }
}

// ---------------------------------------------------------------------------
// Instance registry entry — what the client receives from /secretsservice/instances
// ---------------------------------------------------------------------------

export interface SecretsInstanceEntry {
    id: string;
    shortcode: string;
    type: string;
    name: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@ServiceDescription({
    id: "@theotherwillembotha/secretsservice",
    sourceFile: "@theotherwillembotha/node-red-plugincore"
})
export class SecretsService extends BaseService {

    // Global-backed map keyed by Node-RED config node ID.
    // Cross-bundle safe — survives esbuild boundary between Nodes.js and Plugins.js.
    private static get _instances(): Map<string, { entry: SecretsInstanceEntry; provider: SecretsProvider }> {
        if (!(global as any).__plugincore_secrets_instances__) {
            (global as any).__plugincore_secrets_instances__ = new Map();
        }
        return (global as any).__plugincore_secrets_instances__;
    }

    private static readonly _null = new NullSecretsProvider();

    constructor() {
        super("secrets");
    }

    // ── Registration (called by SecretProviderConfigNode subclasses) ────────

    public static registerInstance(entry: SecretsInstanceEntry, provider: SecretsProvider): void {
        SecretsService._instances.set(entry.id, { entry, provider });
    }

    public static unregisterInstance(id: string): void {
        SecretsService._instances.delete(id);
    }

    // ── Resolution ──────────────────────────────────────────────────────────

    /**
     * Resolve a secret key using the registered provider instance.
     * Falls back to NullSecretsProvider (returns key unchanged) when:
     *   - instanceId is null / undefined / "__null__"
     *   - instanceId refers to a provider that is not currently registered
     */
    public static async resolve(instanceId: string | null | undefined, key: string): Promise<string> {
        if (!instanceId || instanceId === NullSecretsProvider.ID) {
            return SecretsService._null.resolve(key);
        }
        const entry = SecretsService._instances.get(instanceId);
        return entry ? entry.provider.resolve(key) : SecretsService._null.resolve(key);
    }

    // ── Query ───────────────────────────────────────────────────────────────

    public static getInstances(): SecretsInstanceEntry[] {
        return Array.from(SecretsService._instances.values()).map(v => v.entry);
    }

    // ── Service lifecycle ───────────────────────────────────────────────────

    public init(red: NodeAPI<NodeAPISettingsWithData>): void {
        red.httpAdmin.get(
            "/secretsservice/instances",
            red.auth.needsPermission("inject.write"),
            (_req, res) => {
                res.send(SecretsService.getInstances());
            }
        );
    }

    public deinit(_red: NodeAPI<NodeAPISettingsWithData>): void {}
}
