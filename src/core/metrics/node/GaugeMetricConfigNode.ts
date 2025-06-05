
import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig, NodeDescriptor, NodeManager } from "../../NodeConstructor"
import { MetricsContainer, MetricsService, GaugeMetricConfig, GaugeMetric, MetricsReference} from "../service/MetricsService"
import { SourceUtility } from "../../NodeGenerator";
import { MetricsConfigNode } from "./MetricsConfigNode";
import { MetricsTemplate, MetricsTemplateConfig } from "../template/MetricsTemplate";
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";

interface GaugeMetricConfigNodeConfig extends ConfigNodeConfig, GaugeMetricConfig, MetricsTemplateConfig {
    description:string,
    reset:boolean
}

@NodeDescription({
    id:"GaugeMetricConfigNode",
    name:"Guage Metric Config Node",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "GaugeMetricConfigNode.html",
    package: "@theotherwillembotha/nodered_plugincore",
    templates: [
        { template: MetricsTemplate, config: {}}
    ],
    dependencies:[ MetricsConfigNode, MetricsService ],
    tags: [ "Core", "Metric" ]
})
export class GaugeMetricConfigNode extends ConfigNode<GaugeMetricConfigNodeConfig> {
    private _metrics: MetricsContainer;
    private _gauge: GaugeMetric;

    constructor(node: Node, config: GaugeMetricConfigNodeConfig){
        super(node, config);
        let _this = this;

        this._metrics = (NodeManager.RED.nodes.getNode(config.metricsReference) as any).node().metrics();
        
        let gaugeConfig:GaugeMetricConfig = {
            metricname:config.name,
            metricdescription:config.description,
            node:{
                id:this.id(),
                flow:this.flow(),
                type:this.type(),
                name:this.name()
            }
        };
        
        this._gauge = this._metrics.guage(gaugeConfig);
        
        if(config.reset){
            _this._gauge.reset();
        }
    }

    public metrics():MetricsContainer {
        return this._metrics;
    }

    public gauge():GaugeMetric {
        return this._gauge;
    }
}
