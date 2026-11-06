import { BaseService } from "../../NodeConstructor";
import { ServiceDescription } from "../../tagging/ServiceDescriptionDecorator";
import { ProviderRegistry } from "../../registry/service/ProviderRegistry";
import { NodeAPI, NodeAPISettingsWithData } from "node-red";

// ---------------------------------------------------------------------------
// Public interface — what every templating engine must implement
// ---------------------------------------------------------------------------

export interface TemplatingProvider {
    evaluate(template: string, context: object): string;
}

// ---------------------------------------------------------------------------
// Built-in providers
// ---------------------------------------------------------------------------

function getMustache(): any { return require('mustache'); }
function getHandlebars(): any { return require('handlebars'); }

let _hbsHelpersRegistered = false;
function ensureHbsHelpers(): void {
    if (_hbsHelpersRegistered) return;
    _hbsHelpersRegistered = true;
    const Handlebars = getHandlebars();
    Handlebars.registerHelper('json', (ctx: any) => new Handlebars.SafeString(JSON.stringify(ctx)));
}

/** Silent no-op — returns the raw template string unchanged. */
export class DoNothingTemplatingProvider implements TemplatingProvider {
    evaluate(template: string, _context: object): string { return template; }
}

/** Built-in Mustache engine — zero extra dependency. */
export class MustacheTemplatingProvider implements TemplatingProvider {
    evaluate(template: string, context: object): string {
        return getMustache().render(template, context);
    }
}

/** @deprecated Handlebars engine — will be removed in 0.6.0. */
export class HandlebarsTemplatingProvider implements TemplatingProvider {
    evaluate(template: string, context: object): string {
        ensureHbsHelpers();
        return getHandlebars().compile(template)(context);
    }
}

// ---------------------------------------------------------------------------
// Provider category constant — used by both server and client
// ---------------------------------------------------------------------------

export const TEMPLATING_PROVIDER_TYPE = 'TemplatingProvider';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@ServiceDescription({
    id: "@theotherwillembotha/templatingservice",
    sourceFile: "@theotherwillembotha/node-red-plugincore"
})
export class TemplatingService extends BaseService {

    // Global-backed map for cross-bundle safety.
    private static get _providers(): Map<string, TemplatingProvider> {
        if (!(global as any).__plugincore_templating_providers__) {
            (global as any).__plugincore_templating_providers__ = new Map<string, TemplatingProvider>();
        }
        return (global as any).__plugincore_templating_providers__;
    }

    private static readonly _builtIn: TemplatingProvider = new MustacheTemplatingProvider();

    constructor() {
        super("templating");
    }

    /** Register a provider by its type ID. Called from init() for built-ins,
     *  or from external plugin module code for additional engines. */
    public static register(id: string, name: string, provider: TemplatingProvider): void {
        TemplatingService._providers.set(id, provider);
        ProviderRegistry.registerType(TEMPLATING_PROVIDER_TYPE, { id, name });
    }

    public static unregister(id: string): void {
        TemplatingService._providers.delete(id);
        ProviderRegistry.unregisterType(TEMPLATING_PROVIDER_TYPE, id);
    }

    /**
     * Resolve a provider by its registered type ID.
     * Empty / null / undefined falls back to the built-in Mustache engine.
     */
    public static get(typeId: string | null | undefined): TemplatingProvider {
        if (!typeId) return TemplatingService._builtIn;
        return TemplatingService._providers.get(typeId) ?? TemplatingService._builtIn;
    }

    public init(_red: NodeAPI<NodeAPISettingsWithData>): void {
        TemplatingService.register('MustacheTemplatingProvider', 'Mustache (built-in)', new MustacheTemplatingProvider());
        TemplatingService.register('HandlebarsTemplatingProvider', 'Handlebars (deprecated)', new HandlebarsTemplatingProvider());
    }

    public deinit(_red: NodeAPI<NodeAPISettingsWithData>): void {}
}
