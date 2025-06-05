# @theotherwillembotha/nodered_plugincore

A core framework for building production-grade Node-RED plugins, with built-in support for structured logging, Prometheus metrics, and webhook ingestion.

> **Note:** This package serves two purposes: it ships a set of reusable config nodes into Node-RED (logging, metrics, webhook server), and it provides a TypeScript framework that plugin developers extend to build their own nodes. The sections below address each audience separately.

---

## Usage in Node-RED

### Installation

Either use the **Manage Palette** option in the Node-RED editor, or run the following command in your Node-RED user directory (typically `~/.node-red`):

```bash
npm install @theotherwillembotha/nodered_plugincore
```

### Config nodes

This package adds a set of config nodes to your palette. These are shared resources that your own nodes attach to — you configure them once and reference them across your flow.

#### Logging

Three logger implementations are available. All are compatible with any node that uses the `@Logger` decorator.

| Node | Description |
|------|-------------|
| **Console Logger** | Writes log output to stdout via Winston. Useful for development and containerised deployments that forward stdout to a log aggregator. |
| **REST Logger** | Ships log entries to a remote HTTP endpoint. |
| **Loki Logger** | Ships log entries to a Grafana Loki instance. Configure the Loki URL and optional labels in the node's settings. |

#### Metrics

Prometheus-compatible metric collectors. A running Prometheus scrape endpoint is provided automatically when any metric node is deployed.

| Node | Description |
|------|-------------|
| **Counter Metric** | An ever-increasing counter (e.g. messages processed, errors). |
| **Gauge Metric** | A value that goes up and down (e.g. queue depth, active connections). |
| **Timer Metric** | A histogram for measuring durations (e.g. processing time per message). |

#### Webhook Server

| Node | Description |
|------|-------------|
| **Webhook Server** | Runs an Express v5 HTTP server on a configurable port. Supports reverse proxy configuration. Any node using the `@Webhook` decorator registers its routes here. |

---

## Development — Building plugins with this framework

### Prerequisites

- Node.js 18+
- Node-RED 3+
- TypeScript 5+ with `experimentalDecorators` and `emitDecoratorMetadata` enabled

### Installation

```bash
npm install @theotherwillembotha/nodered_plugincore
```

Your `tsconfig.json` must include:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Defining a node

Extend `BaseNode` and annotate the class with `@NodeDescription`. The decorator registers the node type, its editor HTML file, the palette group it appears in, and any shared templates it pulls in.

```typescript
import {
    BaseNode, BaseNodeConfig,
    NodeDescription, SourceUtility,
    LoggerTemplate, LoggerTemplateConfig,
    Log, Logger
} from "@theotherwillembotha/nodered_plugincore";
import { Node } from "node-red";

interface MyNodeConfig extends BaseNodeConfig, LoggerTemplateConfig {
    name: string;
}

@NodeDescription({
    id: "my-node",
    name: "My Node",
    group: "my-plugin",
    sourceFile: SourceUtility.getSourcePath("/build/", "/src/") + "MyNode.html",
    package: "@myscope/my-nodered-plugin",
    templates: [
        { template: LoggerTemplate, config: {} }
    ]
})
class MyNode extends BaseNode<MyNodeConfig> {

    @Logger()
    private log!: Log;

    constructor(node: Node, config: MyNodeConfig) {
        super(node, config);
    }

    protected onInit() {
        this.log.log("MyNode initialised");
    }
}
```

### Available decorators

| Decorator | Property type | What it injects |
|-----------|--------------|-----------------|
| `@Logger()` | `Log` | Winston logger wired to a user-selected logger config node |
| `@Metrics({...})` | `CounterMetric` / `GaugeMetric` / `HistogramMetric` | Prometheus metric collector |
| `@Webhook()` | — | Registers the node with the webhook server |
| `@onInput()` | method | Wires the method as the Node-RED input message handler |

### Templates

Templates bundle reusable UI fragments that compose into any node's editor panel.

| Template | Adds to editor |
|----------|---------------|
| `LoggerTemplate` | Logger selection and message template override |
| `MetricsTemplate` | Metrics configuration section |
| `WebhookTemplate` | Webhook server and reverse proxy configuration |
| `SettingsTemplate` | General settings section |
| `BasicTemplate` | Base styles shared by all nodes |

### Registering nodes for generation

Create a `GenerateNodes.ts` at the root of your `src/` directory. This is the composition root — register every service, template, and node, then call `.generate()` to emit the Node-RED entry files.

```typescript
import { NodeGenerator } from "@theotherwillembotha/nodered_plugincore";
import {
    LoggerService, LoggerTemplate,
    ConsoleLoggerConfigNode, RestLoggerConfigNode, LokiLoggerConfigNode
} from "@theotherwillembotha/nodered_plugincore";
import { MyNode } from "./nodes/MyNode";

new NodeGenerator("./src/")
    .registerService(LoggerService)
    .registerTemplate(LoggerTemplate)
    .registerNode(ConsoleLoggerConfigNode)
    .registerNode(RestLoggerConfigNode)
    .registerNode(LokiLoggerConfigNode)
    .registerNode(MyNode)
    .generate("./build/Nodes", "./build/Plugins");

process.exit(0);
```

### Wiring up package.json

```json
{
  "node-red": {
    "nodes":   { "my-plugin": "./build/Nodes.js"   },
    "plugins": { "my-plugin": "./build/Plugins.js" }
  }
}
```

### Build

```bash
npm run build       # clean → tsc → copy HTML templates → generate node files → copy icons
npm run clean       # remove build/
```

---

## Repository

- Source: [github.com/theotherwillembotha/nodered_plugincore](https://github.com/theotherwillembotha/nodered_plugincore)
- Issues: [github.com/theotherwillembotha/nodered_plugincore/issues](https://github.com/theotherwillembotha/nodered_plugincore/issues)

## License

[ISC](LICENSE)
