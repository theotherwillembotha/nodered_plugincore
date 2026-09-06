
import { BaseNode, NodeManager } from "../NodeConstructor";
import {
  MetricCapability,
  MetricsContainer,
  CounterMetricConfig,
  GaugeMetricConfig,
  HistogramMetricConfig,
  BucketType,
  CounterMetric,
  HistogramMetric,
  SummaryMetric,
  GaugeMetric,
  DoNothingCounterMetric,
  DoNothingGaugeMetric,
  DoNothingHistogramMetric,
  DoNothingSummaryMetric,
  DoNothingMetricsContainer,
} from "./service/MetricsService";
import { MetricsTemplateConfig } from "./template/MetricsTemplate";

export enum MetricType {
  Counter = "Counter",
  Timer   = "Timer",
  Gauge   = "Gauge",
}

export enum MetricCollectorType {
    histogram = "histogram",
    summary   = "summary",
}

type BaseMetricDecoratorConfig = {
    name: string;
    type: MetricType;
    description: string;
}

type CounterMetricDecoratorConfig = BaseMetricDecoratorConfig & { type: MetricType.Counter }
type GaugeMetricDecoratorConfig   = BaseMetricDecoratorConfig & { type: MetricType.Gauge }

type TimerMetricDecoratorConfig = BaseMetricDecoratorConfig & {
  type: MetricType.Timer,
  collector: MetricCollectorType,
}

type SummaryTimerMetricDecoratorConfig = TimerMetricDecoratorConfig & {
  collector: MetricCollectorType.summary,
}

type HistogramTimerMetricDecoratorConfig = TimerMetricDecoratorConfig & {
  collector: MetricCollectorType.histogram,
  buckettype: BucketType,
}

type DefaultHistogramTimerMetricDecoratorConfig = HistogramTimerMetricDecoratorConfig & {
  buckettype: BucketType.default,
}

type MetricsConfig =
  CounterMetricDecoratorConfig |
  GaugeMetricDecoratorConfig |
  SummaryTimerMetricDecoratorConfig |
  DefaultHistogramTimerMetricDecoratorConfig

function resolveMetric(
  node: BaseNode<MetricsTemplateConfig>,
  metricsConfig: MetricsConfig,
  _metrics: MetricsContainer
): CounterMetric | GaugeMetric | HistogramMetric | SummaryMetric | undefined {

  const nde = {
    id:   node.id(),
    name: node.name(),
    flow: node.flow(),
    type: node.type()
  };

  if (metricsConfig.type === MetricType.Counter) {
    if (!_metrics.supports(MetricCapability.Counter)) {
      console.warn(`[PluginCore] @Metrics Counter requested by node "${node.name()}" (${node.type()}) but the selected provider does not support Counter. Using DoNothing.`);
    }
    const counterConfig: CounterMetricConfig = {
      metricname: metricsConfig.name,
      metricdescription: metricsConfig.description,
      node: nde
    };
    return _metrics.counter(counterConfig);
  }

  if (metricsConfig.type === MetricType.Gauge) {
    if (!_metrics.supports(MetricCapability.Gauge)) {
      console.warn(`[PluginCore] @Metrics Gauge requested by node "${node.name()}" (${node.type()}) but the selected provider does not support Gauge. Using DoNothing.`);
    }
    const gaugeConfig: GaugeMetricConfig = {
      metricname: metricsConfig.name,
      metricdescription: metricsConfig.description,
      node: nde
    };
    return _metrics.gauge(gaugeConfig);
  }

  if (metricsConfig.type === MetricType.Timer) {
    if (metricsConfig.collector === MetricCollectorType.histogram) {
      if (!_metrics.supports(MetricCapability.Histogram)) {
        console.warn(`[PluginCore] @Metrics Histogram requested by node "${node.name()}" (${node.type()}) but the selected provider does not support Histogram. Using DoNothing.`);
      }
      if (metricsConfig.buckettype === BucketType.default) {
        const histogramConfig: HistogramMetricConfig = {
          metricname: metricsConfig.name,
          metricdescription: metricsConfig.description,
          buckettype: metricsConfig.buckettype,
          bucketconfig: {},
          node: nde
        };
        return _metrics.histogram(histogramConfig);
      }
    }
    if (metricsConfig.collector === MetricCollectorType.summary) {
      if (!_metrics.supports(MetricCapability.Summary)) {
        console.warn(`[PluginCore] @Metrics Summary requested by node "${node.name()}" (${node.type()}) but the selected provider does not support Summary. Using DoNothing.`);
      }
    }
  }

  console.error("[PluginCore] @Metrics: no factory matched for config", metricsConfig);
  return undefined;
}

function resolveContainer(metricsReference: string): MetricsContainer {
  if (!metricsReference) return new DoNothingMetricsContainer();
  const refNode = NodeManager.RED.nodes.getNode(metricsReference);
  return refNode ? (refNode as any).node().metrics() as MetricsContainer : new DoNothingMetricsContainer();
}

function dudForType(metricsConfig: MetricsConfig): CounterMetric | GaugeMetric | HistogramMetric | SummaryMetric | undefined {
  if (metricsConfig.type === MetricType.Counter) return new DoNothingCounterMetric();
  if (metricsConfig.type === MetricType.Gauge)   return new DoNothingGaugeMetric();
  if (metricsConfig.type === MetricType.Timer) {
    if (metricsConfig.collector === MetricCollectorType.histogram) return new DoNothingHistogramMetric();
    if (metricsConfig.collector === MetricCollectorType.summary)   return new DoNothingSummaryMetric();
  }
  return undefined;
}

export function Metrics(metricsConfig: MetricsConfig): Function {
  return function (target: any, propertyKey: string | symbol) {

    if (typeof propertyKey === "string") {
      const valueSymbol = Symbol(`_${String(propertyKey)}_value`);

      Object.defineProperty(target, propertyKey, {
        get: function() {
          if (this[valueSymbol]) return this[valueSymbol];

          const node = this as BaseNode<MetricsTemplateConfig>;
          const config = node.config();

          if (config.metricsEnabled) {
            const _metrics = resolveContainer(config.metricsReference);
            this[valueSymbol] = resolveMetric(node, metricsConfig, _metrics);
          } else {
            this[valueSymbol] = dudForType(metricsConfig);
          }

          return this[valueSymbol];
        },
        enumerable: true,
        configurable: false
      });

    } else {
      let property = propertyKey as any;
      property.addInitializer(function(this: BaseNode<MetricsTemplateConfig>) {
        const node = this;
        const valueSymbol = Symbol(`_${String(property.name)}_value`);

        Object.defineProperty(node, property.name, {
          get: function() {
            if (this[valueSymbol]) return this[valueSymbol];

            const config = node.config();

            if (config.metricsEnabled) {
              const _metrics = resolveContainer(config.metricsReference);
              this[valueSymbol] = resolveMetric(node, metricsConfig, _metrics);
            } else {
              this[valueSymbol] = dudForType(metricsConfig);
            }

            return this[valueSymbol];
          },
          enumerable: true,
          configurable: false
        });
      });
    }
  };
}
