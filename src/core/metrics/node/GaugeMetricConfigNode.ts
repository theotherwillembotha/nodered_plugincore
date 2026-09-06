
import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig, NodeManager } from "../../NodeConstructor"
import { MetricsContainer, MetricsService, GaugeMetricConfig, GaugeMetric, MetricsReference, DoNothingMetricsContainer} from "../service/MetricsService"
import { SourceUtility } from "../../NodeGenerator";
import { MetricsTemplate, MetricsTemplateConfig } from "../template/MetricsTemplate";
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";

interface GaugeMetricConfigNodeConfig extends ConfigNodeConfig, GaugeMetricConfig, MetricsTemplateConfig {
    description: string,
    reset: boolean
}

@NodeDescription({
    id:"GaugeMetricConfigNode",
    name:"Gauge Metric Config Node",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "GaugeMetricConfigNode.html",
    package: "@theotherwillembotha/node-red-plugincore",
    templates: [
        { template: MetricsTemplate, config: {} }
    ],
    dependencies:[ MetricsService ],
    tags: [ "Core", "Metric" ]
})
export class GaugeMetricConfigNode extends ConfigNode<GaugeMetricConfigNodeConfig> {
    private _metrics: MetricsContainer;
    private _gauge: GaugeMetric;

    constructor(node: Node, config: GaugeMetricConfigNodeConfig){
        super(node, config);

        const refNode = config.metricsEnabled && config.metricsReference ? NodeManager.RED.nodes.getNode(config.metricsReference) : null;
        this._metrics = refNode ? (refNode as any).node().metrics() : new DoNothingMetricsContainer();

        const gaugeConfig: GaugeMetricConfig = {
            metricname: config.name,
            metricdescription: config.description,
            node: {
                id:   this.id(),
                flow: this.flow(),
                type: this.type(),
                name: this.name()
            }
        };

        this._gauge = this._metrics.gauge(gaugeConfig);

        if (config.reset) {
            this._gauge.reset();
        }
    }

    public metrics(): MetricsContainer {
        return this._metrics;
    }

    public gauge(): GaugeMetric {
        return this._gauge;
    }
}
