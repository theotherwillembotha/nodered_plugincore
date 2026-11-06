import { BaseService } from "../../NodeConstructor";
import { ServiceDescription } from "../../tagging/ServiceDescriptionDecorator";
import { NodeAPI, NodeAPISettingsWithData } from "node-red";

export interface ProviderTypeEntry {
    id: string;
    name: string;
    metadata?: Record<string, any>;
}

/**
 * Generic registry for named provider types that are not Node-RED nodes.
 *
 * Consumers register their provider types programmatically (typically from a
 * service's init()), tag them with a category string, and the client discovers
 * them via GET /providerregistry/find?type=<category>.
 *
 * The backing store uses a global key so registrations survive across esbuild
 * bundle boundaries (same safety pattern as TemplatingService._providers).
 */
@ServiceDescription({
    id: "@theotherwillembotha/providerregistry",
    sourceFile: "@theotherwillembotha/node-red-plugincore"
})
export class ProviderRegistry extends BaseService {

    private static get _registry(): Map<string, ProviderTypeEntry[]> {
        if (!(global as any).__plugincore_provider_registry__) {
            (global as any).__plugincore_provider_registry__ = new Map<string, ProviderTypeEntry[]>();
        }
        return (global as any).__plugincore_provider_registry__;
    }

    constructor() {
        super("providerregistry");
    }

    public static registerType(category: string, entry: ProviderTypeEntry): void {
        const registry = ProviderRegistry._registry;
        if (!registry.has(category)) {
            registry.set(category, []);
        }
        const entries = registry.get(category)!;
        if (!entries.find(e => e.id === entry.id)) {
            entries.push(entry);
        }
    }

    public static unregisterType(category: string, id: string): void {
        const entries = ProviderRegistry._registry.get(category);
        if (entries) {
            const idx = entries.findIndex(e => e.id === id);
            if (idx !== -1) entries.splice(idx, 1);
        }
    }

    public static getTypes(category: string): ProviderTypeEntry[] {
        return ProviderRegistry._registry.get(category) ?? [];
    }

    public init(red: NodeAPI<NodeAPISettingsWithData>): void {
        red.httpAdmin.get(
            "/providerregistry/find",
            red.auth.needsPermission("inject.write"),
            (req, res) => {
                const type = req.query.type as string;
                res.send(ProviderRegistry.getTypes(type));
            }
        );
    }

    public deinit(_red: NodeAPI<NodeAPISettingsWithData>): void {}
}
