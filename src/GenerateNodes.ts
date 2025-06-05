
import { NodeTypeService } from "./core/tagging/service/NodeTypeService.js";
import { NodeGenerator, SettingsService, BasicTemplate, SettingsTemplate, TimerMetricTemplate, ConsoleLoggerConfigNode, RestLoggerConfigNode, LokiLoggerConfigNode } from "./index.js"
import { WebhookServerConfigNode, WebhookServerService, WebhookTemplate,  } from "./index.js"

import {LoggerService, LoggerTemplate, LoggerConfigNode } from "./index.js";

import { MetricsService, MetricsTemplate, CounterMetricTemplate, GaugeMetricTemplate} from "./index.js";
import { MetricsConfigNode, GaugeMetricConfigNode, TimerMetricConfigNode, CounterMetricConfigNode } from "./index.js";

new NodeGenerator("./src/core/")
    // services.
    .registerService(LoggerService)
    .registerService(MetricsService)
    .registerService(SettingsService)
    .registerService(WebhookServerService)  
    .registerService(NodeTypeService)

    // templates.
    .registerTemplate(BasicTemplate)
    .registerTemplate(LoggerTemplate)
    .registerTemplate(SettingsTemplate)
    .registerTemplate(MetricsTemplate)
    .registerTemplate(CounterMetricTemplate)
    .registerTemplate(GaugeMetricTemplate)
    .registerTemplate(TimerMetricTemplate)
    .registerTemplate(WebhookTemplate)

    // nodes
    .registerNode(ConsoleLoggerConfigNode)
    .registerNode(RestLoggerConfigNode)
    .registerNode(LokiLoggerConfigNode)
    .registerNode(MetricsConfigNode)
    .registerNode(CounterMetricConfigNode)
    .registerNode(GaugeMetricConfigNode)
    .registerNode(TimerMetricConfigNode)
    .registerNode(WebhookServerConfigNode)

    // done.
    .generate("./build/Nodes", "./build/Plugins");

process.exit(0);