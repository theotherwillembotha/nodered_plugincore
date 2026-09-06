import {BaseNode, BaseNodeConfig, BaseService, FlowDeployment} from "../../NodeConstructor"
import { ServiceDescription } from "../../tagging/ServiceDescriptionDecorator";
import { NodeAPI, NodeAPISettingsWithData } from "node-red";

// ******************************************************* //
//                   Capability                            //
// ******************************************************* //

export enum MetricCapability {
    Counter   = "Counter",
    Gauge     = "Gauge",
    Histogram = "Histogram",
    Summary   = "Summary",
}

// ******************************************************* //
//                   Base / Config Types                   //
// ******************************************************* //

export type MetricsReference = {
    metricsEnabled: boolean,
    metricsReference: string
}

export interface MetricsConfig {
    id: string;
}

export interface NodeReference {
    name: string;
    type: string;
    flow: string;
    id: string;
}

export interface MetricConfig {
    node: NodeReference;
    metricname: string;
    metricdescription?: string;
}

interface Labels {
    flow: string;
    type: string;
    name: string;
    id: string;
    metric: string;
}

export abstract class Metric<ConfigType extends MetricConfig> {
    private _config: ConfigType;
    private _labels: Labels;

    protected constructor(config: ConfigType) {
        this._config = config;
        this._labels = {
            flow: config.node.flow,
            type: config.node.type,
            name: config.node.name,
            id: config.node.id,
            metric: config.metricname
        };
    }

    public labels(): Labels { return this._labels; }
    public config(): ConfigType { return this._config; }
}

// ******************************************************* //
//                   Counter                               //
// ******************************************************* //

export type CounterState = { value: number, labels: {} }
export type CounterCallback = (state: CounterState) => void;
export interface CounterMetricConfig extends MetricConfig { }

export interface CounterMetric {
    inc(): this;
    reset(): void;
    get(): Promise<CounterState>;
    subscribe(node: BaseNode<BaseNodeConfig>, callback: CounterCallback): void;
    unsubscribe(node: BaseNode<BaseNodeConfig>): void;
}

export class DoNothingCounterMetric implements CounterMetric {
    public inc(): this { return this; }
    public reset(): void {}
    public get(): Promise<CounterState> { return Promise.resolve({ value: 0, labels: {} }); }
    public subscribe(_node: BaseNode<BaseNodeConfig>, _callback: CounterCallback): void {}
    public unsubscribe(_node: BaseNode<BaseNodeConfig>): void {}
}

// ******************************************************* //
//                   Gauge                                 //
// ******************************************************* //

export type GaugeState = { value: number }
export type GaugeCallback = (state: GaugeState) => void;
export interface GaugeMetricConfig extends MetricConfig { }

export interface GaugeMetric {
    inc(): this;
    dec(): this;
    reset(): void;
    get(): GaugeState;
    subscribe(node: BaseNode<BaseNodeConfig>, callback: GaugeCallback): void;
    unsubscribe(node: BaseNode<BaseNodeConfig>): void;
}

export class DoNothingGaugeMetric implements GaugeMetric {
    public inc(): this { return this; }
    public dec(): this { return this; }
    public reset(): void {}
    public get(): GaugeState { return { value: 0 }; }
    public subscribe(_node: BaseNode<BaseNodeConfig>, _callback: GaugeCallback): void {}
    public unsubscribe(_node: BaseNode<BaseNodeConfig>): void {}
}

// ******************************************************* //
//                   Histogram                             //
// ******************************************************* //

export type HistogramState = { average(): number | undefined; }
export type HistogramCallback = (state: HistogramState) => void;

export enum BucketType {
    default     = "default",
    manual      = "manual",
    linear      = "linear",
    exponential = "exponential"
}

export interface DefaultBucketConfig { }
export interface ManualBucketConfig { intervals: number[]; }
export interface LinearBucketConfig { start: number; interval: number; count: number; }
export interface ExponentialBucketConfig { start: number; factor: number; count: number; }

export interface HistogramMetricConfig extends MetricConfig {
    buckettype: BucketType;
    bucketconfig: DefaultBucketConfig | ManualBucketConfig | LinearBucketConfig | ExponentialBucketConfig;
}

export interface HistogramMetric {
    observe(value: number): void;
    subscribe(node: BaseNode<BaseNodeConfig>, callback: HistogramCallback): void;
    unsubscribe(node: BaseNode<BaseNodeConfig>): void;
}

export class DoNothingHistogramMetric implements HistogramMetric {
    public observe(_value: number): void {}
    public subscribe(_node: BaseNode<BaseNodeConfig>, _callback: HistogramCallback): void {}
    public unsubscribe(_node: BaseNode<BaseNodeConfig>): void {}
}

// ******************************************************* //
//                   Summary                               //
// ******************************************************* //

export type SummaryState = { average(): number | undefined; }
export type SummaryCallback = (state: SummaryState) => void;

export enum PercentileType {
    default = "default",
    manual  = "manual"
}

export interface DefaultPercentileConfig { }
export interface ManualPercentileConfig { percentiles: number[]; }

export interface SummaryMetricConfig extends MetricConfig {
    percentileType: PercentileType;
    percentileConfig: DefaultPercentileConfig | ManualPercentileConfig;
}

export interface SummaryMetric {
    observe(value: number): void;
    subscribe(node: BaseNode<BaseNodeConfig>, callback: SummaryCallback): void;
    unsubscribe(node: BaseNode<BaseNodeConfig>): void;
}

export class DoNothingSummaryMetric implements SummaryMetric {
    public observe(_value: number): void {}
    public subscribe(_node: BaseNode<BaseNodeConfig>, _callback: SummaryCallback): void {}
    public unsubscribe(_node: BaseNode<BaseNodeConfig>): void {}
}

// ******************************************************* //
//                   MetricsContainer                      //
// ******************************************************* //

export abstract class MetricsContainer {
    public abstract supports(capability: MetricCapability): boolean;
    public abstract hasChanged(config: MetricsConfig): boolean;
    public abstract close(): void;

    // Default implementations warn and return DoNothing — providers override what they support.
    public counter(_config: CounterMetricConfig): CounterMetric {
        console.warn(`[PluginCore] MetricsContainer: Counter is not supported by this provider.`);
        return new DoNothingCounterMetric();
    }
    public gauge(_config: GaugeMetricConfig): GaugeMetric {
        console.warn(`[PluginCore] MetricsContainer: Gauge is not supported by this provider.`);
        return new DoNothingGaugeMetric();
    }
    public histogram(_config: HistogramMetricConfig): HistogramMetric {
        console.warn(`[PluginCore] MetricsContainer: Histogram is not supported by this provider.`);
        return new DoNothingHistogramMetric();
    }
    public summary(_config: SummaryMetricConfig): SummaryMetric {
        console.warn(`[PluginCore] MetricsContainer: Summary is not supported by this provider.`);
        return new DoNothingSummaryMetric();
    }
}

// Silent DoNothing — returned when no provider is installed. Does not warn since this is expected.
export class DoNothingMetricsContainer extends MetricsContainer {
    public supports(_capability: MetricCapability): boolean { return false; }
    public hasChanged(_config: MetricsConfig): boolean { return false; }
    public close(): void {}
    public counter(_config: CounterMetricConfig): CounterMetric { return new DoNothingCounterMetric(); }
    public gauge(_config: GaugeMetricConfig): GaugeMetric { return new DoNothingGaugeMetric(); }
    public histogram(_config: HistogramMetricConfig): HistogramMetric { return new DoNothingHistogramMetric(); }
    public summary(_config: SummaryMetricConfig): SummaryMetric { return new DoNothingSummaryMetric(); }
}

// ******************************************************* //
//                   MetricsService                        //
// ******************************************************* //

const _GLOBAL_METRICS_KEY = '__plugincore_metrics__';

function getMetricsStore(): { [key: string]: MetricsContainer } {
    if (!(global as any)[_GLOBAL_METRICS_KEY]) (global as any)[_GLOBAL_METRICS_KEY] = {};
    return (global as any)[_GLOBAL_METRICS_KEY];
}

@ServiceDescription({
    id: "@theotherwillembotha/metricsservice",
    sourceFile: "@theotherwillembotha/node-red-plugincore"
})
export class MetricsService extends BaseService {

    private red!: NodeAPI<NodeAPISettingsWithData>;

    public constructor() {
        super("MetricsService");
    }

    public init(red: NodeAPI<NodeAPISettingsWithData>): void {
        this.red = red;
    }

    public deinit(_red: NodeAPI<NodeAPISettingsWithData>): void {}

    public async onDeploy(deployment: FlowDeployment): Promise<void> {
        const store = getMetricsStore();
        const flowIds = new Set(deployment.flows.map(e => e.id));

        Object.entries(store)
            .filter(([id]) => !flowIds.has(id))
            .forEach(([id, container]) => {
                delete store[id];
                container.close();
            });

        return Promise.resolve();
    }

    /**
     * Called by MetricsConfigNode subclasses on construction.
     * Preserves an existing container across redeploys if the config has not changed
     * (so counters/gauges are not reset unnecessarily).
     */
    public static register(id: string, config: MetricsConfig, factory: () => MetricsContainer): void {
        const store = getMetricsStore();
        const existing = store[id];
        if (existing && !existing.hasChanged(config)) return;
        if (existing) existing.close();
        store[id] = factory();
    }

    public static get(reference: MetricsReference): MetricsContainer {
        return getMetricsStore()[reference.metricsReference] ?? new DoNothingMetricsContainer();
    }
}
