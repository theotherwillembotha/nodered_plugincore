import * as fs from 'fs';
import * as path from 'path';

import { buildNode, buildNodeBuilder, Template, NodeDescriptor, BaseService, ServiceDescriptor, BaseNode, DependencyType, TemplateDescriptor } from "./NodeConstructor"

const templatePropertyKeys = ["onIncludeOnce", "onIncludeDefaults", "onIncludeEditPrepare", "onIncludeEditPrepare", "onIncludeEditSave", "onIncludeEditForm"];

export interface ITemplateClass {
    new (): Template;
    getTemplateDescriptor(): TemplateDescriptor;
}

export interface INodeClass {
    getNodeDescriptor():NodeDescriptor;
}

export interface IServiceClass {
    getServiceDescriptor():ServiceDescriptor;
}

class NodeGenerator {

    private static headerWidth = 50;
    private static warning:string = `
    This file was automatically generated using the NODERED Core utility.
    Any modifications to his file will be overwritten the next time the code is regenerated.
        
    You have been warned.
    `;

    private _rootFolder:string;
    private _nodes:{[nodeName:string]:{nodeClass:INodeClass, descriptor:NodeDescriptor}} = {};
    private _services:ServiceDescriptor[] = [];
    private _templates:TemplateDescriptor[] = [];

    public constructor(rootFolder:string){
        this._rootFolder = rootFolder;
    }

    private addDependency(dependency: DependencyType): void {
        let hierarchy = TypeUtility.getHierrarchy(dependency as INamedType);

        // check if its a node.
        if(hierarchy.instanceOf(BaseNode)){
            this.registerNode(dependency as INodeClass);
        }

        // check if its a service.
        if(hierarchy.instanceOf(BaseService)){
            this.registerService(dependency as IServiceClass);
        }

        // check if its a template.
        if(hierarchy.instanceOf(Template)){
            this.registerTemplate(dependency as ITemplateClass);
        }
    }

    public registerTemplate(template: ITemplateClass): NodeGenerator {
        try{
            // verify that we dont already have this template.
            let descriptor = template.getTemplateDescriptor();
            if(!this._templates.map(t => t.name()).includes(descriptor.name())){
                this._templates.push(descriptor);
                // FIXME: skip recursive dependency resolution for now.
                // descriptor.dependencies().forEach(dependency => this.addDependency(dependency));
            }
        }
        catch(error){
            console.log("ERROR:", error);
        }

        return this;
    }

    public registerNode(node:INodeClass):NodeGenerator{
        try{
            // verify that we have dont already have this node.
            let descriptor = node.getNodeDescriptor();
            if(!this._nodes[descriptor.id()]){
                this._nodes[descriptor.id()] = {nodeClass:node, descriptor:descriptor};
                // skip the recursive dependencies for now.
                //descriptor.dependencies().forEach(dependency => this.addDependency(dependency));
            }

        }
        catch(error){
            console.log("ERROR:", error);
        }
        return this;
    }

    public registerService(service: IServiceClass):NodeGenerator { 
        try{
            let descriptor = service.getServiceDescriptor();
            if(!this._services.map(s => s.name()).includes(descriptor.name())){
                this._services.push(descriptor);
                // FIXME: skip recursive dependency resolution for now.
                //descriptor.dependencies().forEach(dependency => this.addDependency(dependency));
            }
        }
        catch(error){
            console.log("ERROR:", service, error)
        }
        return this;
    }

    public generate(nodesOutputFile:string, pluginsOutputFile:string){
        // STEP 1. Write an empty Nodes.html.
        // Client-side node type definitions live in Plugins.html (generated below)
        // to prevent HTML-scanning conflicts when multiple plugins bundle the same
        // plugincore infrastructure nodes.
        fs.writeFileSync(nodesOutputFile + ".html", `
<!--
${NodeGenerator.warning}
Client-side node type definitions have been moved to Plugins.html to prevent
duplicate type registration conflicts when multiple plugins share the same
plugincore infrastructure nodes.
-->
        `);

        // Step 3. compose the JS structure for each of the nodes.
        // 1. get a list of the files to import.
        let importList = [
            ...Object.values(this._nodes).map(node => {
                return `const ${node.descriptor.id()} = require("${node.descriptor.package()}").${node.descriptor.id()};`;
                //let nodeFile = "./" + node.group() + "/" + node.sourceFile();
                //return `const ${node.name()} = require("${nodeFile}");`;
            }),
        ]
        .join("\n");

        // 2. get the exported modules that have to be regestered by the node manager.
        let moduleExports = Object.values(this._nodes).map(node => {
            return `    manager.registerNodeType("${node.descriptor.id()}", ${node.descriptor.id()});`;
        }).join("\n");

        fs.writeFileSync(nodesOutputFile + ".js", `
/*
${NodeGenerator.warning}
*/
"use strict";
const { NodeManager } = require("./runtime/NodeManagerRuntime");
${importList}
module.exports = (RED) => {
let manager = new NodeManager(RED);
${moduleExports}
}

        `);

        // Copy NodeManagerRuntime.js into the plugin's build/runtime/ folder so that
        // the generated Nodes.js require("./runtime/NodeManagerRuntime") resolves locally
        // with no dependency on plugincore being installed in the user's environment.
        const outputDir = path.dirname(nodesOutputFile);
        const runtimeDestDir = path.join(outputDir, 'runtime');
        const runtimeDestPath = path.join(runtimeDestDir, 'NodeManagerRuntime.js');

        let runtimeSrcPath: string;
        try {
            // Resolves when this is a consumer plugin — plugincore is in node_modules.
            runtimeSrcPath = require.resolve('@theotherwillembotha/node-red-plugincore/build/runtime/NodeManagerRuntime');
        } catch {
            // We ARE plugincore — NodeManagerRuntime.js is compiled alongside us in build/core/.
            runtimeSrcPath = path.join(__dirname, 'NodeManagerRuntime.js');
        }

        if (path.resolve(runtimeSrcPath) !== path.resolve(runtimeDestPath)) {
            fs.mkdirSync(runtimeDestDir, { recursive: true });
            fs.copyFileSync(runtimeSrcPath, runtimeDestPath);
        }
        console.log(`NodeManagerRuntime.js → ${runtimeDestPath}`);

        console.log(`Done building ${Object.keys(this._nodes).length} nodes\n${Object.values(this._nodes).map(node => " - " + node.descriptor.id() + "\n").join("")}\n`);

        let serviceExports = this._services.map(service => {
            return `    manager.registerService(${service.name()}.${service.name()});`
        }).join("\n")

        let serviceImports = [...this._services.map(service => {
            return `const ${service.name()} = require("${service.sourceFile()}").${service.name()};`;
        })].join("\n")

        let output = `
/*
${NodeGenerator.warning}
*/
"use strict";
const runtime = require("node-red").runtime;
${serviceImports}

module.exports = function (RED) {

    // 1. make a list of all the plugins that need to be installed.
    let pluginList =  [${this._services.map(service => service.name()).join(", ")}]
        .map(service => service.getServiceDescriptor())
        .filter(plugin => !RED.plugins.get(plugin.id()));

    // 2. register a listener if there are any plugins in the pluginList.
    if(pluginList.length > 0){
        RED.events.on('registry:plugin-added', async pluginID => {

            let addedPlugin = pluginList.find(plugin => plugin.id() === pluginID);
            let plugin = RED.plugins.get(pluginID);

            if(addedPlugin && plugin.instantiate && !plugin.instance){
                plugin.instance = new plugin.class();

                // instantiate the plugin.
                await plugin.instance.init(RED);

                // Eagerly call onDeploy with any pre-existing saved flows so that
                // service registries (MetricsService, WebhookServerService, etc.) are
                // populated before config nodes are constructed during flow startup.
                // Without this, MetricsConfigNode._metrics is undefined on first boot.
                const existingFlows = await runtime.flows.getFlows({});
                const hasExistingFlows = existingFlows && existingFlows.flows && existingFlows.flows.length > 0;
                if (hasExistingFlows) {
                    await plugin.instance.onDeploy(existingFlows);
                }

                // publish an event that it has ben deployed.
                RED.events.emit("plugin.instantiated", pluginID);

                pluginList.splice(pluginList.findIndex(current => current.id() === addedPlugin.id()), 1);

                // register a flow deployment listener.
                // startupDeployment is only needed for a truly fresh Node-RED with no saved flows.
                let startupDeployment = !hasExistingFlows;
                RED.events.on('runtime-event', async (event) => {
                    // startup deployment (fresh Node-RED with no pre-existing flows).
                    if ("runtime-deploy" === event?.id && startupDeployment) {
                        startupDeployment = false;
                        const flows = await runtime.flows.getFlows({});
                        await plugin.instance.onDeploy(flows);
                    }

                    // stopping flows on redeployment.
                    if ("runtime-state" === event?.id && event?.payload?.state === "stop" && event?.payload?.deploy) {
                        const flows = await runtime.flows.getFlows({});
                        await plugin.instance.onDeploy(flows);
                    }
                });
            }
        });
    }

    // 3. register the plugins.
    [...pluginList].forEach(plugin => {
        RED.plugins.registerPlugin(plugin.id(), {
            type: plugin.type(),
            instantiate:true,
            class: plugin.clazz()
        });
    })
};
`
        fs.writeFileSync(pluginsOutputFile + ".js", output);
        console.log(`Done building ${this._services.length} services\n${this._services.map(service => " - " + service.name() + "\n").join("")}\n`);

        // STEP 4. Generate Plugins.html with deferred client-side node definitions.
        // All nodes are registered via registry:node-set-added so that:
        //   a) registerType is only called after typeToId/nodeSets are populated, and
        //   b) data-template-name declarations are absent from Nodes.html, avoiding
        //      the HTML-scanning conflict that causes Node-RED to reject an entire
        //      plugin when a second package declares the same node type.
        const seenOnce = new Set<string>();
        const onceHtmlParts: string[] = [];
        const nodePluginParts: string[] = [];

        Object.values(this._nodes).forEach(node => {
            console.log(`Building Plugins.html for: ${node.descriptor.id()}`);
            const nb = buildNodeBuilder(node.nodeClass);

            nb.buildOnceHtml().forEach(({source, html}) => {
                if (!seenOnce.has(source)) {
                    seenOnce.add(source);
                    onceHtmlParts.push(html);
                }
            });

            nodePluginParts.push([
                nb.buildDeferredType(),
                nb.buildHtml(),
                nb.buildDocumentation()
            ].join('\n\n'));
        });

        fs.writeFileSync(pluginsOutputFile + ".html", `
<!--
${NodeGenerator.warning}
-->
${onceHtmlParts.join('\n')}
${nodePluginParts.join('\n\n')}
        `);
        console.log(`Done building Plugins.html\n`);
    }

    private static generateHeader(node:NodeDescriptor){
        let padding = ' '.repeat(Math.max(0, Math.floor(NodeGenerator.headerWidth - node.id().length)/2 ));
        return `
<!-- *${'*'.repeat(NodeGenerator.headerWidth)}* -->
<!-- ${padding} ${node.id()} ${padding}  -->
<!-- *${'*'.repeat(NodeGenerator.headerWidth)}* -->
`;
    }
}



export {
    NodeGenerator
}

export interface INamedType {
    name:string;
}

class TypeUtility {
    private constructor(){}

    private static getPrototypes(t:INamedType):string[] {
        if(!t.name){
            return [];
        }
        else{
            let types = TypeUtility.getPrototypes(Object.getPrototypeOf(t));
            types.push(t.name);
            return types;
        }
    }


    public static getHierrarchy(t:INamedType):Hierarchy {
        return new Hierarchy(TypeUtility.getPrototypes(t));
    }

}

class Hierarchy{
    private types: string[];
    
    public constructor(types:string[]){
        this.types = types;
    }

    public instanceOf(type:INamedType):boolean {
        return this.types.includes(type.name);
    }
}

export class SourceUtility {

    public static getSourcePath(buildPath:string, sourcePath:string):string {
        // use the stack to find the caller of this function.
        
        let _pst = Error.prepareStackTrace
        Error.prepareStackTrace = function (err, stack) { return stack; };
        try {
            // get the crrent stack.
            let err = new Error() as any;

            // the first item in the stack is the current file. call and ignore.
            err.stack.shift().getFileName();

            // the second item in the stack is the actual caller.
            let callerFile = err.stack.shift().getFileName();
            // strip away the filename
            callerFile = callerFile.substring(0, callerFile.lastIndexOf("/")+ 1)
            // spit on the buildPath indicator
            let pcs = callerFile.split(buildPath);
            // extract the last piece.
            let lastPc = pcs.pop();
            // recombine with the buildPath indicator and glue on the last piece with the source pathIndicator
            return pcs.join(buildPath) + sourcePath + lastPc;
        } 
        finally {
            Error.prepareStackTrace = _pst;
        }
    }
}

export type Message = {
    [key:string]:any;
}