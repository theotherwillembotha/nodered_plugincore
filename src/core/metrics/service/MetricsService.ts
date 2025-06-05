import {BaseNode, BaseNodeConfig, BaseService, FlowDeployment, ServiceDescriptor} from "../../NodeConstructor"
import client, {Counter, Gauge, Histogram, HistogramConfiguration, MetricObjectWithValues, MetricValueWithName, register as PrometheusRegistry, Registry, Summary, SummaryConfiguration } from "prom-client";
import { NodeAPI, NodeAPISettingsWithData } from "node-red";
import deepEqual from "deep-equal";


export abstract class Metric<ConfigType extends MetricConfig> {
  private _config: ConfigType;
  private _labels: Labels;
  
  protected constructor(config:ConfigType){
    this._config = config;
    this._labels = {flow:config.node.flow, type:config.node.type, name:config.node.name, id:config.node.id, metric:config.metricname};
  }

  public labels():Labels {
    return this._labels;
  }
  
  public config():ConfigType{
    return this._config;
  }
}

export type MetricsReference = {
  metricsEnabled:boolean,
  metricsReference:string
}

// **************************************************** //
//                   Counter                            //
// **************************************************** //


type CounterCallback = {
  (state:CounterState):void;
};

export type CounterState = {
  value:number,
  labels:{}
}

export interface CounterMetricConfig extends MetricConfig { 
  
}

export class CounterMetric extends Metric<CounterMetricConfig>{
  private counter: Counter;
  private internalCounter: Counter.Internal;
  private subscribers:{[key:string]:CounterCallback} = {};
  constructor(id:string, config:CounterMetricConfig, registry:client.Registry){
    super(config);

    this.counter = new Counter({
      name: id,
      help: (config.metricdescription) ? config.metricdescription: config.metricname,
      labelNames: Object.keys(this.labels()),
      registers: [registry]
    });
    this.counter.reset();
    this.internalCounter = this.counter.labels(this.labels() as any);
  }

  public inc():CounterMetric{
    this.internalCounter.inc();
    this.get().then(state => Object.values(this.subscribers).forEach(callback => callback(state)));
    return this;
  }

  public async get():Promise<CounterState> {
    return this.counter.get().then(t => t.values[0]);
  }

  public reset():void{
    this.counter.reset();
  }

  public subscribe(node:BaseNode<BaseNodeConfig>, callback:CounterCallback){
    this.subscribers[node.id()] = callback;
  }

  public unsubscribe(node:BaseNode<BaseNodeConfig>){
    delete this.subscribers[node.id()];
  }
}

// **************************************************** //
//                   Gauge                              //
// **************************************************** //
type GaugeCallback = {
  (state:GaugeState):void;
};

export interface GaugeState {
  value: number
}

export interface GaugeMetricConfig  extends MetricConfig {

}

export class GaugeMetric extends Metric<GaugeMetricConfig>{
  private collector: number = 0;
  private gauge:Gauge.Internal<string>;
  private subscribers:{[key:string]:GaugeCallback} = {};

  constructor(id:string, config:GaugeMetricConfig, registry:client.Registry){
    super(config);
    let _this = this;

    this.gauge = new client.Gauge({
      name: id,
      help: (config.metricdescription) ? config.metricdescription: config.metricname,
      registers: [registry],
      labelNames: Object.keys(this.labels()),
      // this function is called every time the stats are collected.
      // the response value needs to be set.
      collect() { this.labels(_this.labels() as {}).set(_this.collector); }
    })
  }

  public inc():GaugeMetric{
    this.collector+=1;
    let state:GaugeState = this.get();
    Object.values(this.subscribers).forEach(sub => sub(state));
    return this;
  }

  public dec():GaugeMetric{
    this.collector-=1;
    let state:GaugeState = this.get();
    Object.values(this.subscribers).forEach(sub => sub(state));
    return this;
  }

  public get():GaugeState {
    return {
      value:this.collector,
    }
  }

  public reset():void {
    this.collector = 0;
  }

  public subscribe(node:BaseNode<BaseNodeConfig>, callback:GaugeCallback){
    this.subscribers[node.id()] = callback;
  }

  public unsubscribe(node:BaseNode<BaseNodeConfig>){
    delete this.subscribers[node.id()];
  }
}

// **************************************************** //
//                   Histogram                          //
// **************************************************** //

type HistogramCallback = {
  (state:HistogramState):void;
};

export interface DefaultBucketConfig{

}

export interface ManualBucketConfig{
  intervals:number[];  
}

export interface LinearBucketConfig{
  start:number;
  interval:number;
  count:number;
}

export interface ExponentialBucketConfig{
  start:number;
  factor:number;
  count:number;
}

export interface HistogramMetricConfig extends MetricConfig {
  buckettype:BucketType,
  bucketconfig:DefaultBucketConfig|ManualBucketConfig|LinearBucketConfig|ExponentialBucketConfig
}

export enum BucketType{
  default = "default",
  manual = "manual",
  linear = "linear",
  exponential = "exponential"
}

export class HistogramMetric extends Metric<HistogramMetricConfig> {
  
  private histogram: client.Histogram<string>;
  private subscribers:{[key:string]:HistogramCallback} = {};
  
  constructor(id:string, config:HistogramMetricConfig, registry:Registry){
    super(config);

    // Build the Histogram Config.
    let histogramConfig:HistogramConfiguration<string> = {
      name: id,
      help: (config.metricdescription) ? config.metricdescription: config.metricname,
      labelNames: Object.keys(this.labels()),
      registers:[registry]
    }

    if(config.buckettype === BucketType.default){
      let bucketConfig = (config.bucketconfig as DefaultBucketConfig);
      // do nothing
    }
    if(config.buckettype === BucketType.manual){
      let bucketConfig = (config.bucketconfig as ManualBucketConfig);
      histogramConfig.buckets = bucketConfig.intervals;
    }
    if(config.buckettype === BucketType.linear){
      let bucketConfig = (config.bucketconfig as LinearBucketConfig);
      histogramConfig.buckets = client.linearBuckets(bucketConfig.start, bucketConfig.interval, bucketConfig.count);
    }
    if(config.buckettype === BucketType.exponential){
      let bucketConfig = (config.bucketconfig as ExponentialBucketConfig);
      histogramConfig.buckets = client.exponentialBuckets(bucketConfig.start, bucketConfig.factor, bucketConfig.count);
    }

    this.histogram = new Histogram(histogramConfig);
    this.histogram.zero(this.labels() as any);
  }

  public observe(value:number){
    this.histogram.labels(this.labels() as any).observe(value);
    this.get().then(status => Object.values(this.subscribers).forEach(subscriber => subscriber(status)));
  }

  public async get():Promise<HistogramState>{
    return this.histogram.get().then(t => new HistogramState(t.values));
  }

  public subscribe(node:BaseNode<BaseNodeConfig>, callback:HistogramCallback){
    this.subscribers[node.id()] = callback;
  }

  public unsubscribe(node:BaseNode<BaseNodeConfig>){
    delete this.subscribers[node.id()];
  }
}

class HistogramState {
  private _values: { labels: any; value: number; metricName?:string }[];
  private _average: number | undefined;

  constructor(values:{labels:any, value:number, metricName?:string}[]){
    this._values = values;
    
    let sum = this._values.find(value => value.metricName?.endsWith("_sum"))?.value;
    let count = this._values.find(value => value.metricName?.endsWith("_count"))?.value;
    this._average = (sum && count) ? sum/count : undefined;
  }

  public average():number|undefined{
    return this._average;
  }
}

// **************************************************** //
//                     Summary                          //
// **************************************************** //

interface PercentileConfig{}

class SummaryState {
  private _values: { labels: any; value: number; metricName?:string }[];
  private _average: number | undefined;

  constructor(values:{labels:any, value:number, metricName?:string}[]){
    this._values = values;

    let sum = this._values.find(value => value.metricName?.endsWith("_sum"))?.value;
    let count = this._values.find(value => value.metricName?.endsWith("_count"))?.value;
    this._average = (sum && count) ? sum/count : undefined;
  }

  public average():number|undefined{
    return this._average;
  }
}

type SummaryCallback = (state:SummaryState) => void

export interface DefaultPercentileConfig extends PercentileConfig {
}

export interface ManualPercentileConfig extends PercentileConfig {
  percentiles:number[]
}

export interface SummaryMetricConfig extends MetricConfig {
  percentileType:PercentileType,
  percentileConfig:PercentileConfig
}

export enum PercentileType {
  default = "default",
  manual = "manual"
}

export class SummaryMetric extends Metric<SummaryMetricConfig> {
  private summary: client.Summary;
  private subscribers:{[key:string]:SummaryCallback} = {};
  
  constructor(id:string, config:SummaryMetricConfig, registry:Registry){
    super(config);

    let summaryConfig:SummaryConfiguration<string> = {
      name: id,
      help: (config.metricdescription) ? config.metricdescription: config.metricname,
      labelNames: Object.keys(this.labels()),
      registers:[registry],
    };

    if(config.percentileType === PercentileType.default){
      // do nothing.
      let perceintileConfig:DefaultPercentileConfig = config.percentileConfig as DefaultPercentileConfig;
      summaryConfig.percentiles = [0.01, 0.1, 0.9, 0.99];
    }
    
    if(config.percentileType === PercentileType.manual){
      let percentilesConfig:ManualPercentileConfig = config.percentileConfig as ManualPercentileConfig;
      summaryConfig.percentiles = percentilesConfig.percentiles;
    }

    this.summary = new Summary(summaryConfig);
    //this.summary.zero(this._labels as any);
  }

  public observe(value:number){
    this.summary.labels(this.labels() as any).observe(value);
    this.get().then(status => Object.values(this.subscribers).forEach(subscriber => subscriber(status)));
  }

  public async get():Promise<SummaryState>{
    return this.summary.get().then(s => new SummaryState(s.values));
  }

  public subscribe(node:BaseNode<BaseNodeConfig>, callback:SummaryCallback){
    this.subscribers[node.id()] = callback;
  }

  public unsubscribe(node:BaseNode<BaseNodeConfig>){
    delete this.subscribers[node.id()];
  }
}

// **************************************************** //
//                   COMMONS                            //
// **************************************************** //
interface Labels {
  flow:string;
  type:string;
  name:string;
  id:string;
  metric:string;
}

export class MetricsContainer {
  private _config: MetricsConfig;
  private _registry: client.Registry;

  private counters:{[key:string]:CounterMetric} = {};
  private histograms:{[key:string]:HistogramMetric}  = {};
  private gauges:{[key:string]:GaugeMetric}  = {};
  private summaries:{[key:string]:SummaryMetric} = {};
  
  constructor(config:MetricsConfig){
    this._config = config;

    // create a registry with the config.
    this._registry = new client.Registry();

  }

  close() {
    this._registry.clear();
  }

  public registry():client.Registry{
    return this._registry;
  }

  // return true if the two configurations are not the same.
  hasChanged(config: MetricsConfig): boolean {
    return !(
      this._config.metricsPath === config.metricsPath &&
      this._config.metricsPort === config.metricsPort
    );
  }

  public counter(config: CounterMetricConfig): CounterMetric{
    const counterId = `counter_${config.node.id}`;
    let counter:CounterMetric = this.counters[counterId];
    if(counter){
      // check if the config has changed much.
      if(!deepEqual(counter.config(), config)){
        this._registry.removeSingleMetric(counterId);
        this.counters[counterId] = (counter = new CounterMetric(counterId, config, this._registry));
      }
    }
    else{
      this.counters[counterId] = (counter = new CounterMetric(counterId, config, this._registry));
    }
    
    return counter;
  }

  public guage(config: GaugeMetricConfig): GaugeMetric {
    var guageId = `gauge_${config.node.id}`;
    var gauge:GaugeMetric = this.gauges[guageId];
    if(gauge){
      // check if the config has changed much.
      if(!deepEqual(gauge.config(), config)){
        this._registry.removeSingleMetric(guageId);
        this.gauges[guageId] = (gauge = new GaugeMetric(guageId, config, this._registry));
      }
    }
    else{
      this.gauges[guageId] = (gauge = new GaugeMetric(guageId, config, this._registry));
    }
    return gauge;
  }

  public histogram(config: HistogramMetricConfig): HistogramMetric {
    const histogramId = `histogram_${config.node.id}`;
    let histogram:HistogramMetric = this.histograms[histogramId];
    if(histogram){
      // check if the config has changed much.
      if(!deepEqual(histogram.config(), config)){
        this._registry.removeSingleMetric(histogramId);
        this.histograms[histogramId] = (histogram = new HistogramMetric(histogramId, config, this._registry));
      }
    }
    else{
      this.histograms[histogramId] = (histogram = new HistogramMetric(histogramId, config, this._registry));
    }

    return histogram;
  }

  public summary(config: SummaryMetricConfig): SummaryMetric {
    const summaryId = `summary_${config.node.id}`;
    let summary:SummaryMetric = this.summaries[summaryId];
    if(summary){
      if(!deepEqual(summary.config(), config)){
        this._registry.removeSingleMetric(summaryId);
        this.summaries[summaryId] = (summary = new SummaryMetric(summaryId, config, this._registry));
      }
    }
    else{
      this.summaries[summaryId] = (summary = new SummaryMetric(summaryId, config, this._registry));
    }

    return summary;
  }
}


export class MetricsService extends BaseService {

  private static metrics:{[key:string]:MetricsContainer} = {};
  private red!: NodeAPI<NodeAPISettingsWithData>;
  
  public constructor(){
    super("MetricsService");
  }

  public init(red: NodeAPI<NodeAPISettingsWithData>): void {
    this.red = red;
  }

  public deinit(red: NodeAPI<NodeAPISettingsWithData>): void {
  }

  public async onDeploy(deployment: FlowDeployment): Promise<void> {
    // get the FlowElements.
    let configNodes:{[key:string]:MetricsConfig} = {};
    deployment.flows
      .filter(element => element.type === "MetricsConfigNode")
      .forEach(element => configNodes[element.id] = element as any as MetricsConfig);

    // retire metrics that have been removed or that have changed.
    Object.entries(MetricsService.metrics)
      .filter(([id, metric]) => !configNodes[id] || metric.hasChanged(configNodes[id]))
      .forEach(([id, metric]) => {
        delete MetricsService.metrics[id];
        metric.close();
      });

    // create the new metrics.
    Object.entries(configNodes)
      .filter(([id, metricConfig]) => !MetricsService.metrics[id])
      .forEach(([id, metricConfig]) => {
        MetricsService.metrics[id] = new MetricsContainer(metricConfig);
      })

    return Promise.resolve();
  }

  public static get(reference:MetricsReference):MetricsContainer{
    return MetricsService.metrics[reference.metricsReference];
  }

  static override getServiceDescriptor():ServiceDescriptor {
    return new ServiceDescriptor(
      "@theotherwillembotha/metricsservice",
      "MetricsService",
      "services-plugin",
      "@theotherwillembotha/nodered_plugincore",
      MetricsService
    );
  }
}

export interface MetricsConfig {
  id:string,
  metricsPath:string,
  metricsPort:number,
}

export interface NodeReference {
  name: string;
  type: string;
  flow: string;
  id: string;
}

export interface MetricConfig{
  node:NodeReference;
  metricname: string;
  metricdescription?: string;
}

/*
Quick explanation of how this is supposed to work:

when you deploy a new metricConfig, it should create an instance of "Metric" in the backend.
this instance should survive flow redeployments, but should be removed if the flow that
gets deployed no longer contains the metric. The idea is to not have the metrics reset between
flow deployments or to have the Metric / Repository become unavialable between deployments.

users should be able to access it in this way:

MetricsService.get(<MetricReference>).createCounter(<counterConfig>), though this is mostly just intended for use in the MetricConfigClass.

Normally, a handle on the MetricsService should be gained by pulling a reference to the MetricsConfigNode, eg
  this._metrics = (NodeManager.RED.nodes.getNode(config.metricsReference) as any).node().metrics();
  this._counter = this._metrics.counter(this, "messages", "Number of messages that have passed through this node");

*/