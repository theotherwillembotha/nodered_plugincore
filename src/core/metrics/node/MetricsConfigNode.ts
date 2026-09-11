import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig } from "../../NodeConstructor"
import { MetricsContainer, MetricsService, MetricsConfig } from "../service/MetricsService"

/**
 * Abstract base for all metrics provider config nodes.
 *
 * Concrete implementations (e.g. PrometheusMetricsConfigNode) extend this class,
 * decorate with @NodeDescription + tags: ["MetricsProvider"], and implement
 * createContainer() to return their backend-specific MetricsContainer.
 *
 * This class is intentionally NOT decorated with @NodeDescription - it is never
 * registered as a Node-RED node type directly. Only concrete subclasses are registered.
 */
export abstract class MetricsConfigNode extends ConfigNode<ConfigNodeConfig> {

    constructor(node: Node, config: ConfigNodeConfig) {
        super(node, config);
        MetricsService.register(
            config.id,
            { id: config.id },
            () => this.createContainer({ id: config.id })
        );
    }

    /**
     * Called once on construction to create the backend MetricsContainer.
     * MetricsService preserves the container across redeploys if the config
     * has not changed, so metric state (counters, gauges) is not reset.
     */
    protected abstract createContainer(config: MetricsConfig): MetricsContainer;

    public metrics(): MetricsContainer {
        return MetricsService.get({ metricsEnabled: true, metricsReference: this.id() });
    }
}
