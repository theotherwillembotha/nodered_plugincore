
import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig, NodeManager } from "../../NodeConstructor"
import { MetricsContainer, MetricsService, MetricsReference, CounterMetric, CounterMetricConfig, DoNothingMetricsContainer} from "../service/MetricsService"
import { SourceUtility } from "../../NodeGenerator";
import { MetricsConfigNode } from "./MetricsConfigNode";
import { MetricsTemplate } from "../template/MetricsTemplate";
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";

interface CounterMetricConfigNodeConfig extends ConfigNodeConfig, CounterMetricConfig, MetricsReference {
    description: string,
    reset: boolean
}

@NodeDescription({
    id:"CounterMetricConfigNode",
    name:"Counter Metric Config Node",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "CounterMetricConfigNode.html",
    package: "@theotherwillembotha/node-red-plugincore",
    templates:[
        { template:MetricsTemplate, config: {} }
    ],
    dependencies:[ MetricsService ],
    tags: [ "MetricType" ]
})
export class CounterMetricConfigNode extends ConfigNode<CounterMetricConfigNodeConfig> {
    private _metrics: MetricsContainer;
    private _counter: CounterMetric;

    constructor(node: Node, config: CounterMetricConfigNodeConfig){
        super(node, config);

        const refNode = config.metricsEnabled && config.metricsReference ? NodeManager.RED.nodes.getNode(config.metricsReference) : null;
        this._metrics = refNode ? (refNode as any).node().metrics() : new DoNothingMetricsContainer();

        const counterConfig: CounterMetricConfig = {
            metricname: config.name,
            metricdescription: config.description,
            node: {
                id:   this.id(),
                name: this.name(),
                flow: this.flow(),
                type: this.type()
            }
        };

        this._counter = this._metrics.counter(counterConfig);

        if (config.reset) {
            this._counter.reset();
        }
    }

    public metrics(): MetricsContainer {
        return this._metrics;
    }

    public counter(): CounterMetric {
        return this._counter;
    }
}
