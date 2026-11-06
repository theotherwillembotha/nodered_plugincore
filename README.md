# node-red-plugincore

`@theotherwillembotha/node-red-plugincore` is two things in one package:

**A build system** — a TypeScript-first pipeline that turns decorated classes and HTML fragments into the `Nodes.js` / `Plugins.js` files that Node-RED expects, without you having to write a single `RED.registerType()` call by hand.

**A shared runtime library** — a collection of subsystems (logging, metrics, secrets, webhooks, templating, state) that any plugin can compose into its nodes via dependency injection, without bundling duplicate copies of the infrastructure at runtime.

---

## How it works at a high level

```
Your plugin (TypeScript)
  ├─ Decorated node classes  (@NodeDescription, @onInput, …)
  ├─ Decorated HTML fragments (.html alongside each node)
  └─ GenerateNodes.ts         ← the composition root

npm run build
  ├─ tsc                 → build/   (compiled JS + .d.ts)
  ├─ inline-resources    → embeds .html into the compiled output
  ├─ node GenerateNodes  → build/Nodes.js + build/Plugins.js
  └─ esbuild (optional)  → bundle plugincore into the output for deployment
```

Node-RED loads `Nodes.js` to register node types and `Plugins.js` to register services and client-side UI. Everything in between is handled by the framework.

---

## Installation

```bash
npm install @theotherwillembotha/node-red-plugincore
```

**Peer requirements**

| Requirement | Version |
|---|---|
| Node.js | ≥ 18 |
| Node-RED | ≥ 4.0.0 |
| TypeScript | ≥ 5.0 (dev dependency in your plugin) |
| esbuild | ≥ 0.20 (dev dependency in your plugin) |

---

## Setup

The following steps take you from an empty directory to a plugin that builds cleanly. By the end you will be able to run `npm run build` and have a working (empty) plugin ready to load into Node-RED.

### 1. `package.json`

The minimum `package.json` for a plugincore-based plugin:

```json
{
  "name": "@yourscope/node-red-myplugin",
  "version": "0.1.0",
  "description": "My Node-RED plugin",
  "main": "./build/index.js",
  "types": "./build/index.d.ts",
  "files": ["build/", "icons/", "LICENSE", "README.md"],
  "scripts": {
    "clean":          "rm -rf ./build",
    "build":          "npm run clean && tsc && npm run generate-nodes && npm run bundle",
    "generate-nodes": "node build/GenerateNodes.js",
    "bundle":         "node esbuild.js"
  },
  "engines": { "node": ">=18", "nodered": ">=4.0.0" },
  "node-red": {
    "version": ">=4.0.0",
    "nodes":   { "myplugin": "./build/Nodes.js"   },
    "plugins": { "myplugin": "./build/Plugins.js" }
  },
  "dependencies": {
    "@theotherwillembotha/node-red-plugincore": "^0.5.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "esbuild":    "^0.25.0",
    "@types/node":     "^20.0.0",
    "@types/node-red": "~1.3.5"
  }
}
```

Key points:
- The `node-red.nodes` and `node-red.plugins` entries tell Node-RED which files to load.
- `generate-nodes` runs **after** `tsc` — it needs the compiled JS.
- `bundle` (esbuild) runs last — it bundles plugincore into your output for self-contained deployment.

### 2. `tsconfig.json`

```json
{
  "compilerOptions": {
    "target":                    "es2022",
    "module":                    "commonjs",
    "rootDir":                   "./src",
    "outDir":                    "./build",
    "experimentalDecorators":    true,
    "emitDecoratorMetadata":     true,
    "useDefineForClassFields":   false,
    "declaration":               true,
    "declarationMap":            true,
    "esModuleInterop":           true,
    "strict":                    true,
    "skipLibCheck":              true,
    "forceConsistentCasingInFileNames": true
  },
  "exclude": ["node_modules"]
}
```

> **`useDefineForClassFields: false` is required.** With `es2022` as the target, TypeScript defaults to native class field initializers which silently break legacy decorators. Setting this to `false` restores the prototype-assignment behaviour the decorator system depends on.

### 3. `esbuild.js`

esbuild bundles plugincore (and any other dependencies) into your `Nodes.js` / `Plugins.js` output so that Node-RED only needs to `require` a single self-contained file at runtime. Node-RED itself, plus a small set of plugincore build-time-only packages, are marked as external.

```js
const esbuild = require('esbuild');
const path    = require('path');

// Build-time and host-provided packages that must NOT be bundled.
const external = [
    'node-red',
    'jsdom', 'js-beautify', 'markdown-it',   // used only during node generation
];

const sharedConfig = {
    bundle:   true,
    platform: 'node',
    target:   'node18',
    external,
    format:   'cjs',
    alias: {
        // Nodes.js self-references your package — point it at the local build output.
        '@yourscope/node-red-myplugin': path.resolve('./build/index.js'),
    },
};

async function build() {
    await esbuild.build({ ...sharedConfig, entryPoints: ['build/Nodes.js'],   outfile: 'build/Nodes.js',   allowOverwrite: true });
    console.log('Bundled Nodes.js');
    await esbuild.build({ ...sharedConfig, entryPoints: ['build/Plugins.js'], outfile: 'build/Plugins.js', allowOverwrite: true });
    console.log('Bundled Plugins.js');
}

build().catch(err => { console.error(err); process.exit(1); });
```

### 4. `src/GenerateNodes.ts`

`GenerateNodes.ts` is the composition root of your plugin. It declares which services and nodes the generator should include. Place it at `src/GenerateNodes.ts` — it is compiled alongside your nodes by `tsc` and then executed by `node build/GenerateNodes.js`.

For an empty plugin that is ready to have nodes added to it:

```typescript
import { NodeGenerator, NodeTypeService } from "@theotherwillembotha/node-red-plugincore";

new NodeGenerator("./src/")
    .registerService(NodeTypeService)
    .generate("./build/Nodes", "./build/Plugins", "@yourscope/node-red-myplugin");

process.exit(0);
```

`NodeTypeService` powers the tag registry that plugincore uses internally. It should always be the first entry.

> When you add nodes that use plugincore subsystems (logging, secrets, etc.), the `@NodeDescription` dependency chain resolves the required services automatically. You only need to list services explicitly when you want to guarantee their initialization order, or when registering infrastructure not tied to any specific node.

### 5. Directory structure

```
your-plugin/
├─ src/
│   ├─ GenerateNodes.ts
│   └─ myplugin/
│       └─ node/
│           ├─ MyNode.ts
│           └─ MyNode.html
├─ icons/
├─ esbuild.js
├─ package.json
└─ tsconfig.json
```

### 6. First build

```bash
npm install
npm run build
```

A successful empty build produces:

```
build/
├─ Nodes.js      ← Node-RED node registrations
├─ Plugins.js    ← Node-RED plugin/service registrations
├─ index.js      ← Public API (empty until you export nodes)
└─ index.d.ts    ← Type declarations
```

You can now point Node-RED at your package and it will load without errors. No nodes will appear in the palette yet — that is expected.

---

## Architecture

Understanding the building blocks makes it much easier to work with the shared subsystems. There are five types of things you compose in a plugincore plugin:

### Nodes

A **node** is a flow node — the boxes users drag onto the canvas. It extends `BaseNode<TConfig>` and uses decorators to describe itself to the framework. The `@NodeDescription` decorator provides metadata (id, name, palette group, templates to include) and the `@onInput` decorator marks the method that handles incoming messages.

```typescript
@NodeDescription({
    id:        "MyNode",
    name:      "My Node",
    group:     "myplugin",
    package:   "@yourscope/node-red-myplugin",
    templates: [BasicTemplate],    // ← UI fragments to inject into the editor form
})
export class MyNode extends BaseNode<MyNodeConfig> {

    @onInput()
    protected async messageReceived(message: Message): Promise<void> {
        // handle the message
        this.node().send(message);
    }
}
```

Each node has a companion `.html` file that provides the editor form. The HTML is divided into named sections (`onCompose`, `onIncludeEditForm`, `onIncludeDocumentation`, etc.) which the template engine merges into the final Node-RED editor HTML at build time.

### Config nodes

A **config node** is a shared configuration object that one or more flow nodes reference. It extends `ConfigNode<TConfig>` and uses `@NodeDescription` with `group: "config"`. Config nodes appear in the _Config Nodes_ panel of the editor rather than on the canvas. A common example is a connection config node: many nodes may share one database connection config node rather than each holding their own credentials.

```typescript
@NodeDescription({
    id:    "MyConnectionConfigNode",
    name:  "My Connection",
    group: "config",
    package: "@yourscope/node-red-myplugin",
    templates: [BasicTemplate],
})
export class MyConnectionConfigNode extends ConfigNode<MyConnectionConfig> {
    // lifecycle and shared state
}
```

The key difference between a node and a config node is **ownership**. Flow nodes are instantiated per-node on the canvas. Config nodes are instantiated once and referenced by ID from the flow nodes that need them.

### Templates

A **template** is a reusable bundle of editor UI that can be injected into any node's editor form. Templates are how the shared subsystems add their fields (logger selector, metrics selector, webhook server picker, etc.) to your nodes without you writing any HTML. You declare which templates a node uses in `@NodeDescription({ templates: [...] })`.

```typescript
@NodeDescription({
    id: "MyNode",
    // ...
    templates: [
        BasicTemplate,      // base styles — almost always required
        LoggerTemplate,     // adds the logger selector row to the editor form
        MetricsTemplate,    // adds the metrics selector row
    ],
})
export class MyNode extends BaseNode<MyNodeConfig & LoggerTemplateNodeConfig & MetricsTemplateConfig> { ... }
```

A template is a TypeScript class decorated with `@TemplateDescription`. It declares a companion `.html` file and a list of its own dependencies (other templates, services, nodes it needs to be present). The build system resolves the full dependency tree and merges all sections in the correct order.

### Fragments

A **config fragment** is a configuration section that appears inside a node's editor form but is backed by a _shared_ config node rather than per-node state. Fragments are used when multiple nodes need to reference the same external resource (a logger, a metrics backend, a webhook server) while keeping the configuration in one place.

You do not write fragments directly in most cases — the shared subsystem templates handle them for you. For example, adding `LoggerTemplate` to your node automatically inserts a logger-selector fragment that creates or references a logger config node.

### Services

A **service** extends `BaseService` and provides server-side functionality to Node-RED. Services are registered in `GenerateNodes.ts` and initialized by the framework when Node-RED starts. They expose `httpAdmin` endpoints, manage global state, and act as the server-side counterpart to the client-side templates.

```typescript
@ServiceDescription({ id: "my-service", sourceFile: "..." })
export class MyService extends BaseService {
    public init(red: NodeAPI): void {
        red.httpAdmin.get("/myservice/status", red.auth.needsPermission("inject.write"),
            (_req, res) => res.send({ ok: true }));
    }
    public deinit(_red: NodeAPI): void {}
}
```

Services are cross-bundle safe — they store their shared state on the Node.js `global` object so that the same service instance is reused even when multiple plugins each bundle their own copy of plugincore.

---

## Shared subsystems

### Logger

**Scenario:** You are building a data-processing node. When something goes wrong — a malformed payload, a downstream API failure — you want structured log output with the node name, flow ID, and log level, routed to whichever log backend the user has configured (console, a REST endpoint, Grafana Loki). You do not want to hardcode a transport or force the user to reconfigure every node individually.

The logger subsystem provides a `@Logger` property decorator that lazily resolves a named logger from a shared `LoggerConfigNode`. The user creates one logger config node (e.g. a _Console Logger_ or _Loki Logger_) and references it from each of their nodes. The concrete logger implementations live in separate packages (`node-red-logging`, `node-red-loki`) so your plugin has no transport dependency. If no logger is configured, `DoNothingAppender` silently absorbs all calls.

**Building blocks involved:** Node, Config node (from `node-red-logging`), Template (`LoggerTemplate`)

**Reference implementation:**

`MyProcessorNode.ts`
```typescript
import { BaseNode, BaseNodeConfig, NodeDescription, onInput, Message }
    from "@theotherwillembotha/node-red-plugincore";
import { Logger }
    from "@theotherwillembotha/node-red-plugincore";
import { AbstractLogger, LoggerTemplateNodeConfig, LoggerTemplate, BasicTemplate }
    from "@theotherwillembotha/node-red-plugincore";

export interface MyProcessorNodeConfig extends BaseNodeConfig, LoggerTemplateNodeConfig {}

@NodeDescription({
    id:        "MyProcessorNode",
    name:      "My Processor",
    group:     "myplugin",
    package:   "@yourscope/node-red-myplugin",
    templates: [BasicTemplate, LoggerTemplate],
})
export class MyProcessorNode extends BaseNode<MyProcessorNodeConfig> {

    @Logger()
    private log!: AbstractLogger<any>;

    @onInput()
    protected async messageReceived(message: Message): Promise<void> {
        try {
            // do work ...
            this.log.info("processed message");
            this.node().send(message);
        } catch (err: any) {
            this.log.error(`processing failed: ${err.message}`);
        }
    }
}
```

`MyProcessorNode.html`
```html
<script type="text/javascript" template-section="onCompose">
    node
        .addDefault("name", { value: "My Processor", required: true })
        .setLabel(function() { return this.name || "My Processor"; })
</script>

<script type="text/html" template-section="onIncludeEditForm">
    <div class="form-row">
        <label for="node-input-name"><i class="fa fa-tag"></i> Name</label>
        <input type="text" id="node-input-name" style="width:70%;" />
    </div>
    <!-- LoggerTemplate injects the logger selector automatically below -->
</script>
```

> The `LoggerTemplate` injects a collapsible _Logging_ section into the editor form. The user enables logging, selects their logger config node, and optionally overrides the log template for this specific node. No HTML needed in your `.html` for the logger row itself.

---

### Metrics

**Scenario:** You have a node that calls an external API. You want to count how many calls succeed and how many fail, and you want those counts visible in Prometheus or whatever metrics backend the user has set up — without coupling your node code to `prom-client` directly. If no metrics backend is configured, the counters should do nothing silently.

The metrics subsystem provides `@Metrics` property decorators for counters, gauges, and timers. The user creates a metrics config node (from `node-red-prometheus`) and references it from your node. The `MetricsTemplate` injects the selector row. No backend dependency in your plugin.

**Building blocks involved:** Node, Config node (from `node-red-prometheus`), Template (`MetricsTemplate`), Decorators (`@Metrics`)

**Reference implementation:**

`MyApiNode.ts`
```typescript
import {
    BaseNode, BaseNodeConfig, NodeDescription, onInput, Message,
    Metrics, MetricType, MetricCollectorType, BucketType,
    CounterMetric, MetricsTemplate, MetricsTemplateConfig, BasicTemplate,
} from "@theotherwillembotha/node-red-plugincore";

export interface MyApiNodeConfig extends BaseNodeConfig, MetricsTemplateConfig {}

@NodeDescription({
    id:        "MyApiNode",
    name:      "My API",
    group:     "myplugin",
    package:   "@yourscope/node-red-myplugin",
    templates: [BasicTemplate, MetricsTemplate],
})
export class MyApiNode extends BaseNode<MyApiNodeConfig> {

    @Metrics({ name: "calls_success", type: MetricType.Counter, description: "Successful API calls" })
    private success!: CounterMetric;

    @Metrics({ name: "calls_error", type: MetricType.Counter, description: "Failed API calls" })
    private errors!: CounterMetric;

    @onInput()
    protected async messageReceived(message: Message): Promise<void> {
        try {
            // call external API ...
            this.success.increment();
            this.node().send(message);
        } catch (err) {
            this.errors.increment();
        }
    }
}
```

`MyApiNode.html`
```html
<script type="text/javascript" template-section="onCompose">
    node
        .addDefault("name", { value: "My API", required: true })
        .setLabel(function() { return this.name || "My API"; })
</script>

<script type="text/html" template-section="onIncludeEditForm">
    <div class="form-row">
        <label for="node-input-name"><i class="fa fa-tag"></i> Name</label>
        <input type="text" id="node-input-name" style="width:70%;" />
    </div>
    <!-- MetricsTemplate injects the metrics selector automatically -->
</script>
```

> Timer metrics work the same way with `MetricType.Timer`. Use `MetricCollectorType.histogram` with `BucketType.default` for latency histograms, or `MetricCollectorType.summary` for quantile summaries.

---

### Webhook

**Scenario:** You are integrating with a third-party service (a camera, a payment gateway, a CI system) that pushes events to a URL rather than waiting to be polled. You need an HTTP endpoint inside Node-RED that receives these POST requests, authenticates them, and injects them into the flow as messages. You also want Node-RED to automatically register that URL with an Nginx Proxy Manager instance so the endpoint is reachable from outside without manual DNS or proxy config.

The webhook subsystem manages an Express HTTP server via `WebhookServerConfigNode`. Multiple webhook nodes can share one server on the same port. The `@Webhook` decorator registers a path+method combination and wires the request directly to a method on your node. The `WebhookTemplate` adds the server selector, path, auth config, and reverse-proxy table to your node's editor form.

**Building blocks involved:** Node, Config node (`WebhookServerConfigNode`), Template (`WebhookTemplate`), Decorator (`@Webhook`)

**Reference implementation:**

`MyEventReceiverNode.ts`
```typescript
import {
    BaseNode, BaseNodeConfig, NodeDescription, Message,
    Webhook, EndpointMethodType,
    WebhookTemplate, WebhookTemplateConfig, BasicTemplate,
} from "@theotherwillembotha/node-red-plugincore";
import { Request, Response } from "express";

export interface MyEventReceiverNodeConfig extends BaseNodeConfig, WebhookTemplateConfig {}

@NodeDescription({
    id:        "MyEventReceiverNode",
    name:      "My Event Receiver",
    group:     "myplugin",
    package:   "@yourscope/node-red-myplugin",
    templates: [BasicTemplate, WebhookTemplate],
})
export class MyEventReceiverNode extends BaseNode<MyEventReceiverNodeConfig> {

    @Webhook({ methods: [EndpointMethodType.POST] })
    protected onWebhook(req: Request, res: Response): void {
        const msg = { payload: req.body, headers: req.headers } as unknown as Message;
        this.node().send(msg);
        res.status(200).send({ ok: true });
    }
}
```

`MyEventReceiverNode.html`
```html
<script type="text/javascript" template-section="onCompose">
    node
        .addDefault("name", { value: "My Event Receiver", required: true })
        .setLabel(function() { return this.name || "My Event Receiver"; })
</script>

<script type="text/html" template-section="onIncludeEditForm">
    <div class="form-row">
        <label for="node-input-name"><i class="fa fa-tag"></i> Name</label>
        <input type="text" id="node-input-name" style="width:70%;" />
    </div>
    <!-- WebhookTemplate injects: server selector, path, auth method, reverse proxy table -->
</script>
```

> The `WebhookServerConfigNode` is created by the user from the Config Nodes panel. They set the port once and all webhook nodes on the same server share it. The reverse proxy table in the editor form lets the user map a domain name to this endpoint via an Nginx Proxy Manager instance — plugincore creates and updates the proxy host entry automatically on each deploy.

---

### Secrets

**Scenario:** Your node needs a database password or an API key to do its job. You could store it as a plain string in the flow, but that leaks credentials into the flow JSON and makes rotation painful. What you really want is a _reference_ to a secret — a key string that is resolved at runtime against whatever secrets backend the user has set up (OpenBao, AWS SSM, HashiCorp Vault). If no backend is configured, the value itself is the secret (a sensible default for simple deployments).

The secrets subsystem provides a `SecretsTemplate` with a `PluginCore.initSecretField` helper that renders a secret field as either a password input (when only the built-in `NullSecretsProvider` is available) or a `typedInput` selector (when external providers are configured). The user creates provider instances from the **Secrets** sidebar (🔑 tab). At runtime, `SecretsService.resolve()` looks up the value via the selected provider. Provider implementations live in separate packages; `NullSecretsProvider` is always present as a fallback.

**Building blocks involved:** Node, Config node (`SecretProviderConfigNode`, from an external provider package), Template (`SecretsTemplate`), Service (`SecretsService`)

**Reference implementation:**

`MyDatabaseNode.ts`
```typescript
import {
    BaseNode, BaseNodeConfig, NodeDescription, onInput, Message,
    SecretsTemplate, SecretsService, BasicTemplate,
} from "@theotherwillembotha/node-red-plugincore";

export interface MyDatabaseNodeConfig extends BaseNodeConfig {
    dbPassword:         string;   // the key string (or literal value for NullProvider)
    dbPasswordProvider: string;   // the config node ID of the selected provider
    host: string;
}

@NodeDescription({
    id:        "MyDatabaseNode",
    name:      "My Database",
    group:     "myplugin",
    package:   "@yourscope/node-red-myplugin",
    templates: [BasicTemplate, SecretsTemplate],
})
export class MyDatabaseNode extends BaseNode<MyDatabaseNodeConfig> {

    @onInput()
    protected async messageReceived(message: Message): Promise<void> {
        const config = this.config();
        const password = await SecretsService.resolve(
            config.dbPasswordProvider,
            config.dbPassword
        );
        // use password to connect ...
        this.node().send(message);
    }
}
```

`MyDatabaseNode.html`
```html
<script type="text/javascript" template-section="onCompose">
    node
        .addDefault("name",               { value: "My Database", required: true })
        .addDefault("host",               { value: "", required: true })
        .addDefault("dbPassword",         { value: "" })
        .addDefault("dbPasswordProvider", { value: "__null__",
                                            type: "DelegatedConfigReferenceNode" })
        .setLabel(function() { return this.name || "My Database"; })
</script>

<script type="text/javascript" template-section="onIncludeEditPrepare">
{
    PluginCore.initSecretField("node-input-dbPassword", {
        node:          this,
        valueField:    "dbPassword",
        providerField: "dbPasswordProvider",
        hideValue:     true,
    });
}
</script>

<script type="text/javascript" template-section="onIncludeEditSave">
{
    var secret = PluginCore.readSecretField("node-input-dbPassword");
    this.dbPassword         = secret.value;
    this.dbPasswordProvider = secret.provider;
    PluginCore.destroySecretField("node-input-dbPassword");
}
</script>

<script type="text/javascript" template-section="onIncludeEditCancel">
{
    PluginCore.destroySecretField("node-input-dbPassword");
}
</script>

<script type="text/html" template-section="onIncludeEditForm">
    <div class="form-row">
        <label for="node-input-name"><i class="fa fa-tag"></i> Name</label>
        <input type="text" id="node-input-name" style="width:70%;" />
    </div>
    <div class="form-row">
        <label for="node-input-host"><i class="fa fa-server"></i> Host</label>
        <input type="text" id="node-input-host" style="width:70%;" />
    </div>
    <div class="form-row">
        <label for="node-input-dbPassword"><i class="fa fa-key"></i> Password</label>
        <input type="text" id="node-input-dbPassword" style="width:70%;" />
    </div>
</script>
```

> `PluginCore.initSecretField` renders the field as a plain password input when only `NullSecretsProvider` is available, or as a `typedInput` selector (showing shortcode badges like `local 🔒`, `prod 🔑`) when external providers are deployed. The node stores both the key string and the provider ID, and `SecretsService.resolve()` handles the lookup at runtime.
>
> The `SecretsLookupNode` (included in plugincore) is a ready-made single-purpose node that does nothing but resolve a secret and place the result on `msg.payload`. Use it to test your provider configuration before wiring it into a more complex flow.

---

### Templating

**Scenario:** You are building a notification node that formats outgoing messages — email bodies, Slack messages, alert texts. The format should be user-configurable with a template string, not hardcoded. Different users prefer different template engines: some are happy with `{{payload}}` (Mustache), others need Handlebars helpers. You want to offer a template field in the editor and let the user (or admin) choose the engine, without coupling your node to any specific template library.

The templating subsystem provides a `TemplatingTemplate` that adds a template editor and engine selector to your node's form. At runtime, `TemplatingService.get(providerName)` returns the selected engine and `provider.evaluate(template, context)` renders the string. The built-in `MustacheTemplatingProvider` is always available. Handlebars and others can be added via separate provider packages.

**Building blocks involved:** Node, Config node (`TemplatingProviderConfigNode`, from an optional provider package), Template (`TemplatingTemplate`), Service (`TemplatingService`)

**Reference implementation:**

`MyNotificationNode.ts`
```typescript
import {
    BaseNode, BaseNodeConfig, NodeDescription, onInput, Message,
    TemplatingTemplate, TemplatingTemplateNodeConfig,
    TemplatingService, BasicTemplate,
} from "@theotherwillembotha/node-red-plugincore";

export interface MyNotificationNodeConfig
    extends BaseNodeConfig, TemplatingTemplateNodeConfig {}

@NodeDescription({
    id:        "MyNotificationNode",
    name:      "My Notification",
    group:     "myplugin",
    package:   "@yourscope/node-red-myplugin",
    templates: [BasicTemplate, TemplatingTemplate],
})
export class MyNotificationNode extends BaseNode<MyNotificationNodeConfig> {

    @onInput()
    protected async messageReceived(message: Message): Promise<void> {
        const config   = this.config();
        const provider = TemplatingService.get(config.templatingProvider);
        const text     = provider.evaluate(config.templateContent || '', message as object);

        // send text to Slack, email, etc. ...
        message.payload = text;
        this.node().send(message);
    }
}
```

`MyNotificationNode.html`
```html
<script type="text/javascript" template-section="onCompose">
    node
        .addDefault("name", { value: "My Notification", required: true })
        .setLabel(function() { return this.name || "My Notification"; })
</script>

<script type="text/html" template-section="onIncludeEditForm">
    <div class="form-row">
        <label for="node-input-name"><i class="fa fa-tag"></i> Name</label>
        <input type="text" id="node-input-name" style="width:70%;" />
    </div>
    <!-- TemplatingTemplate injects: engine selector + template editor -->
</script>
```

> The `TemplatingTemplate` injects a full Ace-based template editor and an engine selector into your node's form. The `TemplatingNode` (included in plugincore) is a ready-made standalone node for ad hoc template evaluation — use it to verify that your template strings produce the expected output before wiring them into a notification node.

---

### State

**Scenario:** You are building a rate-limiter node. It needs to remember how many messages passed through in the last minute, and that counter must survive a Node-RED redeploy (flow save + restart) but reset on a full Node-RED process restart. You want that behaviour to be configurable per-node without each node reimplementing its own persistence logic.

The state subsystem provides a `StateTemplate` that adds a state configuration section to your node's form. Each node gets a `StateHandle` with `get()`, `set()`, and `clear()` methods. The user chooses whether state survives redeployment and/or process restarts. The built-in `InternalStateConfigNode` stores state in memory (with optional file-backed persistence). External providers can be added via separate packages.

**Building blocks involved:** Node, Config node (`InternalStateConfigNode`, auto-created on first open), Template (`StateTemplate`)

**Reference implementation:**

`MyRateLimiterNode.ts`
```typescript
import {
    BaseNode, BaseNodeConfig, NodeDescription, onInput, Message,
    StateTemplate, StateTemplateNodeConfig,
    StateService, StateHandle, BasicTemplate,
} from "@theotherwillembotha/node-red-plugincore";

export interface MyRateLimiterNodeConfig
    extends BaseNodeConfig, StateTemplateNodeConfig {
    limit: number;
}

@NodeDescription({
    id:        "MyRateLimiterNode",
    name:      "My Rate Limiter",
    group:     "myplugin",
    package:   "@yourscope/node-red-myplugin",
    templates: [BasicTemplate, StateTemplate],
})
export class MyRateLimiterNode extends BaseNode<MyRateLimiterNodeConfig> {

    private _state!: StateHandle;

    constructor(node: any, config: MyRateLimiterNodeConfig) {
        super(node, config);
        this._state = StateService.get(config);
        // Seed counter to zero if this is the first time the node has run.
        if (this._state.get() === null) this._state.set("0");
    }

    @onInput()
    protected async messageReceived(message: Message): Promise<void> {
        const count = parseInt(this._state.get() ?? "0", 10) + 1;
        this._state.set(String(count));

        if (count > this.config().limit) {
            // drop message — rate limit exceeded
            return;
        }
        this.node().send(message);
    }
}
```

`MyRateLimiterNode.html`
```html
<script type="text/javascript" template-section="onCompose">
    node
        .addDefault("name",  { value: "My Rate Limiter", required: true })
        .addDefault("limit", { value: 100, required: true })
        .setLabel(function() { return this.name || "My Rate Limiter"; })
</script>

<script type="text/html" template-section="onIncludeEditForm">
    <div class="form-row">
        <label for="node-input-name"><i class="fa fa-tag"></i> Name</label>
        <input type="text" id="node-input-name" style="width:70%;" />
    </div>
    <div class="form-row">
        <label for="node-input-limit"><i class="fa fa-tachometer"></i> Limit</label>
        <input type="number" id="node-input-limit" style="width:70%;" />
    </div>
    <!-- StateTemplate injects: state provider selector + persistence options -->
</script>
```

> The `InternalStateConfigNode` is created automatically the first time the node editor is opened — the user does not need to create it manually. The state template adds a collapsible _State_ section where the user can choose whether the counter survives redeployment and/or a full restart.

---

## Extensible subsystems — abstract types and backend services

Each shared subsystem described above is split across three layers. Understanding this split is what makes it possible to build a node that uses structured logging without depending on Winston, or one that emits metrics without depending on `prom-client`.

### The problem this solves

If your node imported `winston` directly, every plugin that uses your node would pull Winston into their bundle whether they wanted it or not. If the user then installed a Loki plugin, they would have two separate Winston instances with no shared configuration. And if they ever wanted to swap the transport, they would have to touch every node individually.

The abstract-type pattern inverts this dependency. Your node only knows about an interface (`AbstractLogger`, `MetricsContainer`, `StateHandle`, `SecretsProvider`). The concrete implementation — which knows about Winston, `prom-client`, OpenBao, or Zookeeper — lives in a separate package. plugincore provides a silent `DoNothing*` fallback for every interface, so your node degrades gracefully when no backend is installed.

```
plugincore (this package)
  └── defines AbstractLogger, LoggerConfigNode (abstract)
  └── DoNothingAppender — silent fallback, always present

node-red-logging (separate package, installed by user)
  └── ConsoleLoggerConfigNode extends LoggerConfigNode
  └── RestLoggerConfigNode    extends LoggerConfigNode

node-red-loki (separate package, installed by user)
  └── LokiLoggerConfigNode    extends LoggerConfigNode

Your plugin
  └── @Logger() — resolves whichever LoggerConfigNode the user picked
                   falls back to DoNothingAppender if none is configured
```

Your node does not import `node-red-logging` or `node-red-loki`. At deploy time, `@Logger()` calls `RED.nodes.getNode(config.loggerReference)` and gets back whatever concrete config node the user configured.

### Abstract base classes

Each subsystem defines an abstract base class for its config node. The base class is **not decorated with `@NodeDescription`** — it is never registered as a Node-RED type. It exists only to be extended. The constructor handles all the lifecycle work (registration, close hooks) so the concrete subclass only needs to implement one method.

| Subsystem | Abstract config node base | Method to implement | Fallback |
|---|---|---|---|
| Logger | `LoggerConfigNode<C, L>` | `logger(): AbstractLogger<C>` | `DoNothingAppender` |
| Metrics | `MetricsConfigNode` | `createContainer(config): MetricsContainer` | `DoNothingMetricsContainer` |
| State | `StateConfigNode` | `createHandle(): StateHandle` | `DoNothingStateHandle` |
| Secrets | `SecretProviderConfigNode` | `resolve(key): Promise<string>` | `NullSecretsProvider` |
| Templating | _(provider, not a config node — see below)_ | `evaluate(template, context): string` | `DoNothingTemplatingProvider` |

### How to implement a provider — Logger as the full example

Here is what implementing a new logger backend looks like. The pattern is the same for every subsystem.

**`ConsoleLoggerConfigNode.ts`** (in `node-red-logging`)
```typescript
import {
    LoggerConfigNode, LoggerConfigNodeConfig, AbstractLogger,
    LoggerTemplateConfig, Log, NodeDescription, ConfigNode,
} from "@theotherwillembotha/node-red-plugincore";

// 1. Define your config interface
export interface ConsoleLoggerConfig extends LoggerConfigNodeConfig {
    level: string;
    template: string;
}

// 2. Implement the concrete logger (the thing that actually writes)
class ConsoleLogger extends AbstractLogger<ConsoleLoggerConfig> {
    protected createLogger(config: LoggerTemplateConfig): Log {
        return new ConsoleLog(config);
    }
}

// 3. Decorate and extend the abstract config node
@NodeDescription({
    id:    "ConsoleLoggerConfigNode",
    name:  "Console Logger",
    group: "config",
    package: "@yourscope/node-red-logging",
    tags: ["LoggerType"],           // ← makes this discoverable as a logger backend
})
export class ConsoleLoggerConfigNode
    extends LoggerConfigNode<ConsoleLoggerConfig, ConsoleLogger> {

    constructor(node: Node, config: ConsoleLoggerConfig) {
        super(node, config);
    }

    protected logger(): ConsoleLogger {
        return new ConsoleLogger(this.config());
    }
}
```

The `tags: ["LoggerType"]` annotation is what allows the **Logger selector** in every node's editor form to find this config node type. `NodeTypeService` maintains the tag index server-side; the client calls `GET /nodetypeservice/find?tag=LoggerType` to get the list of available logger types.

### The Templating subsystem — a provider, not a config node

Templating providers are slightly different from the other subsystems. Rather than extending a config node base, a templating provider is a plain class that implements a single-method interface:

```typescript
export interface TemplatingProvider {
    evaluate(template: string, context: object): string;
}
```

Providers are registered programmatically from a service's `init()` method via `TemplatingService.registerProvider()`, not through a config node. This is because template engines are stateless — there is no per-instance configuration to store. The user selects a provider once per node from the engine dropdown; no config node is created.

```typescript
// Inside your provider package's service init():
TemplatingService.registerProvider("HandlebarsTemplatingProvider",
    new HandlebarsTemplatingProvider());
```

The client discovers available providers via `GET /providerregistry/find?type=TemplatingProvider`.

### Backend services and their HTTP endpoints

The backend services are the server-side glue that makes the editor UI work. Each one runs in the Node-RED process and exposes one or more `httpAdmin` endpoints that the client-side templates call.

| Service | Endpoint | What the client uses it for |
|---|---|---|
| `NodeTypeService` | `GET /nodetypeservice/find?tag=<tag>` | Discovers all registered node types with a given tag. Used by Logger/Metrics/State/Secrets selectors to populate their type dropdowns. |
| `ProviderRegistry` | `GET /providerregistry/find?type=<category>` | Discovers non-node providers (e.g. templating engines) registered programmatically. |
| `TemplatingService` | `GET /templatingservice/providers` | Lists available template engines for the engine selector. |
| `MetricsService` | _(global store, no HTTP endpoint)_ | Keeps `MetricsContainer` instances alive across redeployments so counters are not reset when a flow is saved. |
| `SecretsService` | `GET /secretsservice/instances` | Returns all currently-deployed secret provider instances (shortcode, name, type). Used by `initSecretField` to build the type selector and by the Secrets sidebar. |
| `StateService` | _(global store, no HTTP endpoint)_ | Manages per-node `StateHandle` instances and factory registrations. |
| `LoggerService` | _(no HTTP endpoint)_ | Shared entry point for `DoNothingAppender`; `@Logger()` resolves the logger config node directly via `RED.nodes.getNode()`. |

### Cross-bundle safety

Because each plugin bundles its own copy of plugincore via esbuild, there can be multiple copies of `MetricsService` or `SecretsService` loaded at runtime. If each copy kept state in a module-level variable, registrations from one bundle would be invisible to another.

Every service that holds shared state stores it on `global` under a fixed key instead:

```typescript
private static get _instances() {
    if (!(global as any).__plugincore_secrets_instances__) {
        (global as any).__plugincore_secrets_instances__ = new Map();
    }
    return (global as any).__plugincore_secrets_instances__;
}
```

This means the first bundle to initialize a service creates the backing store; every subsequent bundle finds it already there and uses the same map. Provider registrations, metric containers, state handles, and secret provider instances are all shared correctly regardless of which bundle wrote them.

---

## Writing your first node

A minimal flow node — no subsystems, just a message handler:

**`src/myplugin/node/HelloNode.ts`**
```typescript
import { BaseNode, BaseNodeConfig, NodeDescription, onInput, Message }
    from "@theotherwillembotha/node-red-plugincore";
import { BasicTemplate } from "@theotherwillembotha/node-red-plugincore";

export interface HelloNodeConfig extends BaseNodeConfig {
    greeting: string;
}

@NodeDescription({
    id:        "HelloNode",
    name:      "Hello",
    group:     "myplugin",
    package:   "@yourscope/node-red-myplugin",
    templates: [BasicTemplate],
})
export class HelloNode extends BaseNode<HelloNodeConfig> {

    @onInput()
    protected async messageReceived(message: Message): Promise<void> {
        message.payload = this.config().greeting || "Hello, world!";
        this.node().send(message);
    }
}
```

**`src/myplugin/node/HelloNode.html`**
```html
<script type="text/javascript" template-section="onCompose">
    node
        .addDefault("greeting", { value: "Hello, world!", required: true })
        .setLabel(function() { return this.greeting || "Hello"; })
</script>

<script type="text/html" template-section="onIncludeEditForm">
    <div class="form-row">
        <label for="node-input-greeting">Greeting</label>
        <input type="text" id="node-input-greeting" placeholder="Hello, world!" style="width:70%;" />
    </div>
</script>
```

Register it in `GenerateNodes.ts`:

```typescript
import { NodeGenerator, NodeTypeService } from "@theotherwillembotha/node-red-plugincore";
import { HelloNode } from "./myplugin/node/HelloNode.js";

new NodeGenerator("./src/")
    .registerService(NodeTypeService)
    .registerNode(HelloNode)
    .generate("./build/Nodes", "./build/Plugins", "@yourscope/node-red-myplugin");

process.exit(0);
```

Rebuild and reload Node-RED — your node will appear in the palette under the `myplugin` category.

---

## Publishing

Before publishing to npm and the [Node-RED Flow Library](https://flows.nodered.org/add/node):

- [ ] `package.json` `keywords` includes `"node-red"` and any relevant technology tags
- [ ] `package.json` specifies minimum Node-RED version under `engines.nodered`
- [ ] Each node has a populated `onIncludeDocumentation` section in its HTML
- [ ] `README.md` describes prerequisites and basic usage
- [ ] Build passes cleanly (`npm run build` with no errors)
- [ ] No test/demo nodes left in `GenerateNodes.ts`

```bash
npm publish
```

Then submit manually at https://flows.nodered.org/add/node.
