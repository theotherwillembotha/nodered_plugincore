
import { BaseNode, NodeManager } from "../NodeConstructor";
import { BucketType, CounterMetricConfig, DefaultBucketConfig, ExponentialBucketConfig, HistogramMetricConfig, LinearBucketConfig, ManualBucketConfig, MetricsContainer, Metric, MetricConfig, CounterMetric, HistogramMetric, SummaryMetric, GaugeMetric, GaugeMetricConfig } from "./service/MetricsService";
import { MetricsTemplateConfig } from "./template/MetricsTemplate";

export enum MetricType {
  Counter = "Counter",
  Timer = "Timer",
  Gauge = "Gauge",
}

export enum MetricCollectorType {
    histogram = "histogram",
    summary = "summary",
}


type BaseMetricDecoratorConfig = {
    name:string;
    type:MetricType;
    description:string;
}

type CounterMetricDecoratorConfig = BaseMetricDecoratorConfig & {
  type:MetricType.Counter
}

type GaugeMetricDecoratorConfig = BaseMetricDecoratorConfig & {
  type:MetricType.Gauge
}

type TimerMetricDecoratorConfig = BaseMetricDecoratorConfig & {
  type:MetricType.Timer,
  collector:MetricCollectorType,
}

type SummaryTimerMetricDecoratorConfig = TimerMetricDecoratorConfig & {
  collector:MetricCollectorType.summary,
}

type HistogramTimerMetricDecoratorConfig = TimerMetricDecoratorConfig & {
  collector:MetricCollectorType.histogram,
  buckettype:BucketType,
  //bucketconfig:DefaultBucketConfig|ManualBucketConfig|LinearBucketConfig|ExponentialBucketConfig,
}

type DefaultHistogramTimerMetricDecoratorConfig = HistogramTimerMetricDecoratorConfig & {
  buckettype:BucketType.default,
  bucketconfig?:DefaultBucketConfig
}

type MetricsConfig = 
  CounterMetricDecoratorConfig | 
  GaugeMetricDecoratorConfig | 
  SummaryTimerMetricDecoratorConfig | 
  DefaultHistogramTimerMetricDecoratorConfig

export function Metrics(metricsConfig: MetricsConfig):Function {
  return function (target: any, propertyKey: string | symbol) {

    // if the type is a string, then its probably defined in the local (core) module.
    if(typeof propertyKey === "string"){
      const valueSymbol = Symbol(`_${String(propertyKey)}_value`);

      Object.defineProperty(target, propertyKey, {
        get: function() {
          if(this[valueSymbol]){
            return this[valueSymbol];
          }

          //console.log("injecting metric", valueSymbol);
          let node = this as BaseNode<MetricsTemplateConfig>;
          let config = node.config();

          if(config.metricsEnabled){
            let _metrics = (NodeManager.RED.nodes.getNode(config.metricsReference) as any).node().metrics() as MetricsContainer;
            
            let nde = {
              id:node.id(),
              name:node.name(),
              flow:node.flow(),
              type:node.type()
            }

            // counter metric
            if(metricsConfig.type === MetricType.Counter){
              let counterConfig:CounterMetricConfig = {
                metricname:metricsConfig.name,
                metricdescription:metricsConfig.description,
                node:nde
              };
              this[valueSymbol] = _metrics.counter(counterConfig);
              return this[valueSymbol];
            }

            // gauge metric
            if(metricsConfig.type === MetricType.Gauge){
              let gaugeConfig:GaugeMetricConfig = {
                metricname:metricsConfig.name,
                metricdescription:metricsConfig.description,
                node:nde
              };
              this[valueSymbol] = _metrics.gauge(gaugeConfig);
              return this[valueSymbol];
            }

            // timer metric.
            if(metricsConfig.type === MetricType.Timer){

              // handle it as a histogram collector.
              if(metricsConfig.collector === MetricCollectorType.histogram){

                // handle it as the default bucket.
                if(metricsConfig.buckettype === BucketType.default){
                  let histogramConfig:HistogramMetricConfig = {
                    metricname:metricsConfig.name,
                    metricdescription:metricsConfig.description,
                    buckettype:metricsConfig.buckettype,
                    bucketconfig:{},
                    node:nde
                  };
                  this[valueSymbol] = _metrics.histogram(histogramConfig);
              return this[valueSymbol];
                }
              }
            }
            console.error("No Metric Factory type defined for ", metricsConfig);
            return this[valueSymbol];
          }        
          
          this[valueSymbol] =
            (metricsConfig.type === MetricType.Counter) ? { inc(){}, reset(){} } as CounterMetric :
            (metricsConfig.type === MetricType.Gauge)   ? { inc(){}, dec(){}, reset(){} } as GaugeMetric :
            (metricsConfig.type === MetricType.Timer)   ? { observe(val:number){} } as HistogramMetric | SummaryMetric 
            : undefined;
          return this[valueSymbol];
        },
        enumerable: true,
        configurable: false
      });
      return
    }
    else{
      let property = propertyKey as any;
      property.addInitializer(function(this:BaseNode<MetricsTemplateConfig>){
        let node = this as BaseNode<MetricsTemplateConfig>
        const valueSymbol = Symbol(`_${String(property.name)}_value`);

        Object.defineProperty(node, property.name, {
          get: function() {
            if(this[valueSymbol]){
              return this[valueSymbol];
            }

            //console.log("injecting metric", valueSymbol);
            let config = node.config();

            if(config.metricsEnabled){
              let _metrics = (NodeManager.RED.nodes.getNode(config.metricsReference) as any).node().metrics() as MetricsContainer;
              
              let nde = {
                id:node.id(),
                name:node.name(),
                flow:node.flow(),
                type:node.type()
              }

              // counter metric
              if(metricsConfig.type === MetricType.Counter){
                let counterConfig:CounterMetricConfig = {
                  metricname:metricsConfig.name,
                  metricdescription:metricsConfig.description,
                  node:nde
                };
                this[valueSymbol] = _metrics.counter(counterConfig);
                return this[valueSymbol];
              }

              // gauge metric
              if(metricsConfig.type === MetricType.Gauge){
                let gaugeConfig:GaugeMetricConfig = {
                  metricname:metricsConfig.name,
                  metricdescription:metricsConfig.description,
                  node:nde
                };
                this[valueSymbol] = _metrics.gauge(gaugeConfig);
                return this[valueSymbol];
              }

              // timer metric.
              if(metricsConfig.type === MetricType.Timer){

                // handle it as a histogram collector.
                if(metricsConfig.collector === MetricCollectorType.histogram){

                  // handle it as the default bucket.
                  if(metricsConfig.buckettype === BucketType.default){
                    let histogramConfig:HistogramMetricConfig = {
                      metricname:metricsConfig.name,
                      metricdescription:metricsConfig.description,
                      buckettype:metricsConfig.buckettype,
                      bucketconfig:{},
                      node:nde
                    };
                    this[valueSymbol] = _metrics.histogram(histogramConfig);
                    return this[valueSymbol];
                  }
                }
              }
              console.error("No Metric Factory type defined for ", metricsConfig);
              return this[valueSymbol];
            }        
            
            this[valueSymbol] =
              (metricsConfig.type === MetricType.Counter) ? { inc(){}, reset(){} } as CounterMetric :
              (metricsConfig.type === MetricType.Gauge)   ? { inc(){}, dec(){}, reset(){} } as GaugeMetric :
              (metricsConfig.type === MetricType.Timer)   ? { observe(val:number){} } as HistogramMetric | SummaryMetric 
              : undefined;
            return this[valueSymbol];
          },
          enumerable: true,
          configurable: false
        });
      });
    }
  };
}