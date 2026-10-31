
import { NodeGenerator } from "./index.js"
import { NodeTypeService } from "./core/tagging/service/NodeTypeService.js";
import { ProviderRegistry } from "./core/registry/service/ProviderRegistry.js";
import { TemplatingService } from "./core/templating/service/TemplatingService.js";
import { DelegatedConfigReferenceNode } from "./core/other/node/DelegatedConfigReferenceNode.js";
import { TemplatingNode } from "./core/templating/TemplatingNode.js";

// NodeTypeService is always first (powers the tag registry).
// ProviderRegistry must precede any service that calls ProviderRegistry.registerType().
// DelegatedConfigReferenceNode is core infrastructure — register it explicitly so it
// is always present regardless of which consumer plugins are installed.
new NodeGenerator("./src/core/")
    .registerService(NodeTypeService)
    .registerService(ProviderRegistry)
    .registerService(TemplatingService)
    .registerNode(DelegatedConfigReferenceNode)
    .registerNode(TemplatingNode)
    .generate("./build/Nodes", "./build/Plugins", "@theotherwillembotha/node-red-plugincore");

process.exit(0);
