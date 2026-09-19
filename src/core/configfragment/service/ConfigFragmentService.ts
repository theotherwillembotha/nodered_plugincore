import { BaseService, FlowDeployment } from "../../NodeConstructor";
import { ServiceDescription } from "../../tagging/ServiceDescriptionDecorator";
import { NodeAPI, NodeAPISettingsWithData } from "node-red";

export interface ConfigFragmentRegistration {
    section: string;       // e.g., "TimerMetricConfig" - which slot this fragment fills
    providerType: string;  // e.g., "PrometheusMetricsConfigNode" - matches the selected config node's type
    html: string;          // the HTML + lifecycle script to inject into the editor
}

@ServiceDescription({
    id: "@theotherwillembotha/configfragmentservice",
    sourceFile: "@theotherwillembotha/node-red-plugincore"
})
export class ConfigFragmentService extends BaseService {

    // Global-backed registry so fragments registered across bundle boundaries are visible.
    private static get _fragments(): ConfigFragmentRegistration[] {
        if (!(global as any).__plugincore_config_fragments__) {
            (global as any).__plugincore_config_fragments__ = [];
        }
        return (global as any).__plugincore_config_fragments__;
    }

    constructor() {
        super("configfragments");
    }

    public init(red: NodeAPI<NodeAPISettingsWithData>): void | Promise<void> {
        red.httpAdmin.get(
            "/configfragment/:section/:providerType",
            red.auth.needsPermission("inject.write"),
            (request: any, response: any) => {
                const { section, providerType } = request.params;
                const fragment = ConfigFragmentService._fragments.find(
                    f => f.section === section && f.providerType === providerType
                );
                if (fragment) {
                    response.type('text/html').send(fragment.html);
                } else {
                    response.status(404).send('');
                }
            }
        );

        return Promise.resolve();
    }

    public deinit(red: NodeAPI<NodeAPISettingsWithData>): void | Promise<void> {
        return Promise.resolve();
    }

    /**
     * Register a config fragment. Called by provider plugins during their service init().
     * Provider plugins own both sides of the contract: the HTML fragment that collects
     * the configuration AND the server-side factory that deserializes it.
     */
    public static registerFragment(registration: ConfigFragmentRegistration): void {
        const existing = ConfigFragmentService._fragments.find(
            f => f.section === registration.section && f.providerType === registration.providerType
        );
        if (!existing) {
            ConfigFragmentService._fragments.push(registration);
        }
    }
}
