
import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig, NodeDescriptor, NodeManager } from "../../NodeConstructor"
import { MetricsContainer, MetricsService, BucketType, HistogramMetric, HistogramMetricConfig, SummaryMetricConfig, PercentileType, SummaryMetric} from "../service/MetricsService"
import { SourceUtility } from "../../NodeGenerator";
import { MetricsConfigNode } from "./MetricsConfigNode";
import { MetricsTemplate, MetricsTemplateConfig } from "../template/MetricsTemplate";
import { MetricCollectorType } from "../MetricsDecorator";
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";



interface TimerMetricConfigNodeConfig extends ConfigNodeConfig, MetricsTemplateConfig {
    description:string,
    metricType: MetricCollectorType,

    buckettype: BucketType,
    buckettype_manual_intervals:string,
    buckettype_linear_start:string,
    buckettype_linear_interval:string,
    buckettype_linear_count:string,
    buckettype_exponential_start:string,
    buckettype_exponential_factor:string,
    buckettype_exponential_count:string,

    percentiletype:PercentileType,
    percentiletype_manual_intervals:string,
}

@NodeDescription({
    id:"TimerMetricConfigNode",
    name:"Timer Metric Config Node",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "TimerMetricConfigNode.html",
    package: "@theotherwillembotha/nodered_plugincore",
    templates: [
        { template: MetricsTemplate, config: {isConfigNode:true}}
    ],
    dependencies:[ MetricsConfigNode, MetricsService ],
    tags: [ "Core", "Metric" ]
})
export class TimerMetricConfigNode extends ConfigNode<TimerMetricConfigNodeConfig> {
    private _metrics: MetricsContainer;
    private _timer!: HistogramMetric|SummaryMetric;

    constructor(node: Node, config: TimerMetricConfigNodeConfig){
        super(node, config);
        let _this = this;

        this._metrics = (NodeManager.RED.nodes.getNode(config.metricsReference) as any).node().metrics();

        let bucketConfig:any = {}

        switch(config.buckettype){
            case BucketType.default:{
                // do nothing
                break;
            }
            case BucketType.manual:{
                bucketConfig.intervals = config.buckettype_manual_intervals.split(",").map(i => Number.parseFloat(i.trim()));
                break;
            }
            case BucketType.linear:{
                bucketConfig.start = config.buckettype_linear_start;
                bucketConfig.interval = config.buckettype_linear_interval;
                bucketConfig.count = config.buckettype_linear_count;
                break;
            }
            case BucketType.exponential:{
                bucketConfig.start = config.buckettype_exponential_start;
                bucketConfig.factor = config.buckettype_exponential_factor;
                bucketConfig.count = config.buckettype_exponential_count;
                break;
            }
        }

        if(config.metricType === MetricCollectorType.histogram){
            let timerConfig:HistogramMetricConfig = {
                node:{
                    id: this.id(),
                    name: this.name(),
                    flow: this.flow(),
                    type: this.type()
                },
                buckettype:config.buckettype,
                bucketconfig:bucketConfig,
                metricname:config.name,
                metricdescription:config.description
            }

            this._timer = this._metrics.histogram(timerConfig);
        }
        if(config.metricType === MetricCollectorType.summary) {
            let timerConfig:SummaryMetricConfig = {
                node:{
                    id: this.id(),
                    name: this.name(),
                    flow: this.flow(),
                    type: this.type()
                },
                percentileType:config.percentiletype,
                percentileConfig:config.percentiletype_manual_intervals,
                metricname:config.name,
                metricdescription:config.description,
            }

            this._timer = this._metrics.summary(timerConfig);
        }
    }

    public metrics():MetricsContainer {
        return this._metrics;
    }

    public timer():HistogramMetric|SummaryMetric {
        return this._timer;
    }
}
