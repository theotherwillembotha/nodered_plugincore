
import { NodeGenerator } from "./index.js"
import { NodeTypeService } from "./core/tagging/service/NodeTypeService.js";

// Plugincore is a build framework — it has no leaf nodes of its own.
// Infrastructure nodes (DelegatedConfigReferenceNode, config nodes, etc.)
// are pulled in automatically via template dependencies when downstream
// packages register their nodes.
//
// NodeTypeService is the one service that must always be present because
// it powers the tag registry used by NodeManager at runtime.
new NodeGenerator("./src/core/")
    .registerService(NodeTypeService)
    .generate("./build/Nodes", "./build/Plugins", "@theotherwillembotha/node-red-plugincore");

process.exit(0);
