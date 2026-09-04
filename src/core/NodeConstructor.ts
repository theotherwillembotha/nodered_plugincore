import { Node, NodeAPI, NodeAPISettingsWithData} from "node-red";
import { INamedType, INodeClass, ITemplateClass } from "./NodeGenerator";

import "reflect-metadata";
import fs from 'fs';

import {
    NODEMANAGER_API_VERSION,
    POST_CONSTRUCT_KEY,
    BaseNodeConfig,
    runPostConstructInitializers,
    NodeManager
} from "./NodeManagerRuntime";

// Re-export so existing downstream code keeps working unchanged.
export {
    NODEMANAGER_API_VERSION,
    POST_CONSTRUCT_KEY,
    BaseNodeConfig,
    runPostConstructInitializers,
    NodeManager
};

export abstract class BaseNode<Config extends BaseNodeConfig> {

    private _node:Node;
    public node() { return this._node; }

    private _config:Config;
    public config() { return this._config; }
    
    private _flow:string
    public flow() { return this._flow; }

    // THIS value is imported from NodeRed Node itself.
    public id() { return this.config().id };
    public type() { return this.config().type };
    public name() { return this.config().name };

    protected constructor(node: Node, config: Config){
        this._node = node;
        this._config = config;
        this._flow = (this._node._flow?.flow as any).label;

        // inject a reverse lookup so the NodeRedNode can refer back to the waos node:
        (this._node as any).node = () => { return this; }
    }

    // this function can be overwritten to be triggered after the constructor and
    // decorators have been called.
    protected onInit(){}

    // note: this function should be implemented by every concrete implementation of the BaseNode class.
    public static getNodeDescriptor():NodeDescriptor{
        throw new Error("getNodeDescriptor not implemented.");
    }
}

export interface ConfigNodeConfig extends BaseNodeConfig {
}

export abstract class ConfigNode<Config extends ConfigNodeConfig> extends BaseNode<Config> {

    protected constructor(node:Node, config: Config){
        super(node, config);
    }

    public static getNodeDescriptor():NodeDescriptor{
        throw new Error("getNodeDescriptor not implemented.");
    }
}

export interface Component{

}

export interface TemplateConfig {
}

export type NodeDependencyType = INamedType & (INodeClass | IServiceClass);

export class NodeDescriptor {
    private _group:string;
    private _id:string;
    private _name:String;
    private _sourceFile: string;
    private _dependencies: DependencyType[] = []
    private _templates:{template:ITemplateClass, config:TemplateConfig}[] = [];
    private _package: string;
    private _tags: string[] = [];

    constructor(group:string, id:string, name:string, sourceFile:string, pkg:string){
        this._group = group;
        this._id = id;
        this._name = name;
        this._sourceFile = sourceFile;
        this._package = pkg;
    }

    // DEPRECATED
    public addDependency(dependency:NodeDependencyType):NodeDescriptor{
        this._dependencies.push(dependency);
        return this;
    }

    // DEPRECATED
    public addTag(tag:string):NodeDescriptor{
        this._tags.push(tag);
        return this;
    }

    // DEPRECATED
    public addTemplate(template:ITemplateClass, config:TemplateConfig):NodeDescriptor{
        // TODO: we can only add every template once.
        this._dependencies.push(template);
        this._templates.push({template:template, config:config});
        return this;
    }

    public group(){ return  this._group; }
    public id(){ return this._id; }
    public name(){ return this._name; }
    public sourceFile() { return this._sourceFile; }
    public package() { return this._package; }
    public dependencies():DependencyType[] { return this._dependencies; }
    public templates():{template:ITemplateClass, config:TemplateConfig}[]{ return this._templates; }
    public tags():string[] { return this._tags; }
}

interface IServiceClass {
    new (): BaseService;
    getServiceDescriptor():ServiceDescriptor;
}

export class TemplateDescriptor{
    private _name: string;
    private _dependencies: DependencyType[];
    private _clazz: ITemplateClass;
    private _templateFile: string;
 
    constructor(name:string, clazz:ITemplateClass, templateFile:string, dependencies:DependencyType[]){
        this._name = name;
        this._clazz = clazz;
        this._templateFile = templateFile;
        this._dependencies = dependencies;
    }
 
    name(): string {
        return  this._name;
    }

    clazz(): ITemplateClass {
        return this._clazz;
    }

    dependencies():DependencyType[]{
        return this._dependencies;
    }

    templateFile():string {
        return this._templateFile;
    }
    
}

export class ServiceDescriptor {

    private _id: string;
    private _name:string;
    private _type: string;
    private _sourceFile:string;
    private _clazz:IServiceClass;
    private _dependencies:DependencyType[];
    
    public constructor(id:string, name:string, type:string, sourceFile:string, clazz:IServiceClass, dependencies?:DependencyType[]){
        this._id = id;
        this._name = name;
        this._type = type;
        this._sourceFile = sourceFile;
        this._clazz = clazz;
        this._dependencies = dependencies ? dependencies : [];
    }

    public id():string { return this._id };
    public name():string { return this._name };
    public type():string { return this._type };
    public sourceFile():string { return this._sourceFile };
    public clazz():IServiceClass { return this._clazz };
    public dependencies() { return this._dependencies };
}

export type DependencyType = INamedType & (ITemplateClass | INodeClass | IServiceClass);

export abstract class Template{
    public static getTemplateDescriptor():TemplateDescriptor {
        throw new Error("getTemplateDescriptor not implemented for " + this.name);
    }
}

// POST CONSTRUCT INITALIZERS **********************

type VoidMethod = (...args: any[]) => void | Promise<void>;

// Builder class for post-construct decorators
class PostConstructDecoratorBuilder<TMetadata = any> {
    private decoratorName: string;
    private initLogic?: (instance: any, propertyKey: string, metadata: any) => void;
    private validator?: (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
    private defaultConfig?: TMetadata;

    constructor(decoratorName: string) {
        this.decoratorName = decoratorName;
    }

    // Set default config for when brackets are omitted
    withDefaultConfig(config: TMetadata) {
        this.defaultConfig = config;
        return this;
    }

    // Method to set initialization logic
    withInitLogic(initLogic: (instance: any, propertyKey: string, metadata: any) => void) {
        this.initLogic = initLogic;
        return this;
    }
    
    // Method to set custom validation logic
    withValidator(validator: (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void) {
        this.validator = validator;
        return this;
    }

    // Build the actual decorator factory (returns a function that takes metadata and returns a decorator)
    build() {
        const decoratorName = this.decoratorName;
        const initLogic = this.initLogic;
        const validator = this.validator;
        const defaultConfig = this.defaultConfig;

        // The actual decorator implementation
        const decoratorImpl = (config: TMetadata) => {
            return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
                try{
                    const className = target.constructor.name;
                    const originalMethod = descriptor.value;

                    if (typeof originalMethod !== 'function') {
                        throw new Error(
                            `@${decoratorName} decorator error:\n` +
                            `  Class: ${className}\n` +
                            `  Property: ${propertyKey}\n` +
                            `  Issue: Decorator can only be applied to methods.`
                        );
                    }

                    const returnType = Reflect.getMetadata?.('design:returntype', target, propertyKey);
                    if (returnType && returnType !== Promise && returnType !== void 0 && returnType !== undefined) {
                        console.warn(
                            `@${decoratorName} decorator warning:\n` +
                            `  Class: ${className}\n` +
                            `  Method: ${propertyKey}\n` +
                            `  Issue: Method should return void or Promise<void>, but appears to return ${returnType.name}.`
                        );
                    }

                    if (validator) {
                        try {
                            validator(target, propertyKey, descriptor);
                        } catch (error) {
                            throw new Error(
                                `@${decoratorName} decorator validation error:\n` +
                                `  Class: ${className}\n` +
                                `  Method: ${propertyKey}\n` +
                                `  Issue: ${error instanceof Error ? error.message : String(error)}`
                            );
                        }
                    }

                    const wrappedMethod = async function(this: any, ...args: any[]): Promise<void> {
                        const result = await originalMethod.apply(this, args);
                        if (result !== undefined && result !== null) {
                            console.warn(
                                `@${decoratorName} runtime warning:\n` +
                                `  Class: ${className}\n` +
                                `  Method: ${propertyKey}\n` +
                                `  Issue: Method returned a value (${typeof result}) but should return void or Promise<void>.`
                            );
                        }
                    };

                    if (!target[POST_CONSTRUCT_KEY]) {
                        target[POST_CONSTRUCT_KEY] = [];
                    }

                    target[POST_CONSTRUCT_KEY].push((instance: any) => {
                        if (initLogic) {
                            try {
                                initLogic(instance, propertyKey, config);
                            } catch (error) {
                                throw new Error(
                                    `@${decoratorName} initialization error:\n` +
                                    `  Class: ${className}\n` +
                                    `  Method: ${propertyKey}\n` +
                                    `  Issue: ${error instanceof Error ? error.message : String(error)}`
                                );
                            }
                        }
                    });

                    descriptor.value = wrappedMethod;
                    return descriptor;
                }
                catch(e){
                    console.error("failed creating DecoratorImplementation:", "target:", target,"propertyKey:", propertyKey, "descriptor:", descriptor, "error:", e);
                    throw e;
                }
            };
        };

        // Return overloaded decorator that works with or without ()
        const overloadedDecorator: any = function(
            targetOrConfig: any,
            propertyKey?: string,
            descriptor?: PropertyDescriptor
        ) {
            // Check if called without brackets (directly on method)
            if (propertyKey !== undefined && descriptor !== undefined) {
                // Called as @decorator (without brackets)
                return decoratorImpl(defaultConfig as TMetadata)(targetOrConfig, propertyKey, descriptor);
            } else {
                // Called as @decorator() or @decorator({...})
                return decoratorImpl(targetOrConfig as TMetadata);
            }
        };

        return overloadedDecorator;
    }
}

// Factory function to create decorator builders
export function createPostConstructDecorator<TMetadata = any>(decoratorName: string) {
    return new PostConstructDecoratorBuilder<TMetadata>(decoratorName);
}

export type FlowDeployment = {
    rev:string,
    flows:[FlowElement]
}

export type FlowElement = {
    id:string;
    type:string;
  }
  

export abstract class BaseService {
    
    private _name: string;

    constructor(name:string){
        this._name = name;
    }

    public name():string {
        return this._name;
    }

    public abstract init(red:NodeAPI<NodeAPISettingsWithData>):Promise<void>|void
    public abstract deinit(red:NodeAPI<NodeAPISettingsWithData>):Promise<void>|void
    
    public onDeploy(flowDeployment: FlowDeployment):Promise<void>|void{
        return Promise.resolve();
    }

    public static getServiceDescriptor():ServiceDescriptor {
        throw new Error("getServiceDescriptor not implemented.");
    }
}

// Build-time deps — lazy loaded so they are never required at runtime in production bundles.
// These are only invoked during `npm run build` (GenerateNodes), never in the deployed container.
function getJSDOM(): any { return require('jsdom').JSDOM; }
function getBeautify(): any { return require('js-beautify'); }
function getHandlebars(): any { return require('handlebars'); }

let _md: any = null;
function getMd(): any {
    if (!_md) {
        _md = require('markdown-it')({ html: true, linkify: true, typographer: true });
        _md.renderer.rules.heading_open = (tokens: any[], idx: number) => {
            const level = tokens[idx].tag.substring(1);
            return `<h${level} class="custom-heading">`;
        };
        _md.renderer.rules.heading_close = (tokens: any[], idx: number) => {
            const level = tokens[idx].tag.substring(1);
            return `</h${level}>`;
        };
    }
    return _md;
}

let beautifyOptions = {
    "indent_size": 4,
    "preserve-newlines": false,
    "html": {
        "end_with_newline": true,
        "js": {
            "indent_size": 2,
            "preserve-newlines": false
        },
        "css": {
            "indent_size": 2,
        }
    },
    "css": {
        "indent_size": 1
    },
    "js": {
        "preserve-newlines": false
    },
};

export type DefaultTemplateType = {
    type?:string;
    value?:string;
    required:boolean;
    minInstances?:number;
    maxInstances?:number;
    validate?:Function;
    list?:boolean;
}

export class NodeBuilder {
    // see https://nodered.org/docs/creating-nodes/node-html#node-definition
    private _name: string;
    private _category: string;
    private _defaults:{[name:string]:DefaultTemplateType} = {};
    private _credentials?: string;      // TODO
    private _color?: string;
    private _label?: string;
    private _icon?: string;
    private _paletteLabel?: string;
    private _labelStyle?: string;
    private _inputs?:string;
    private _outputs:string[] = [];
    private _onIncludeOnce:{source:string, script:string}[] = [];
    private _onIncludeEditPrepare:{source:string, script:string}[] = [];
    private _onIncludeEditSave:{source:string, script:string}[] = [];
    private _onIncludeEditCancel:{source:string, script:string}[] = [];
    private _onIncludeEditDelete:{source:string, script:string}[] = [];
    private _onIncludeEditForm:{source:string, script:string}[] = [];
    private _onIncludeDocumentation:{source:string, script:string}[] = [];

    constructor(name:string, category:string){
        this._name = name;
        this._category = category;
    }

    public addDefault(name:string, template:DefaultTemplateType):NodeBuilder{
        // if list:true, this is an array of config references — generate shadow defaults for each slot.
        if(template.list === true) {
            template.maxInstances =  template.maxInstances ? template.maxInstances : 10;
            this._defaults[name] = {value:"", required:(template.required) ? template.required : false, maxInstances:template.maxInstances};
            for(let i = 0; i < template.maxInstances; i++){
                this._defaults["_" + name + "_" + i] = {value:"", required:false, type: template.type};
            }
        }
        else{
            this._defaults[name] = template;
        }
        return this;
    }

    public setIcon(icon:string):NodeBuilder{
        this._icon = icon;
        return this;
    }

    public setColor(color:string):NodeBuilder{
        this._color = color;
        return this;
    }

    public setLabel(label:() => {}):NodeBuilder{
        this._label = label.toString();
        return this;
    }
    public setPaletteLabel(paletteLabel:string):NodeBuilder{
        this._paletteLabel = paletteLabel;
        return this;
    }

    public setLabelStyle(labelStyle:string):NodeBuilder{
        this._labelStyle = labelStyle;
        return this;
    }

    public setInput(input:string):NodeBuilder{
        this._inputs = input;
        return this;
    }

    public addOutputs(...outputs:string[]):NodeBuilder{
        outputs.forEach(output => this._outputs.push(output));
        return this;
    }

    public addTemplate(template: { template: ITemplateClass; config: TemplateConfig; }): NodeBuilder {
        let templateDescriptor = template.template.getTemplateDescriptor();

        // load the html source file
        let uiDom = new (getJSDOM())(fs.readFileSync(templateDescriptor.templateFile()!));

        // apply the onCompose section if available.
        let onCompose = uiDom.window.document.querySelector("script[template-section='onCompose']")?.innerHTML;
        if(onCompose){
            evalInContext({ node:this }, onCompose.toString()!);
        }

        // load the other sections and add them as needed.
        let sections:string[] = ['IncludeOnce', 'IncludeEditPrepare', 'IncludeEditSave', 'IncludeEditCancel', 'IncludeEditDelete', 'IncludeEditForm', 'IncludeDocumentation'];
        Object.values(sections).forEach(section => {
            let sectionData = uiDom.window.document.querySelector(`[template-section='on${section}']`)?.innerHTML;
            if(sectionData){
                (this as any)[`add${section}`](templateDescriptor.name(), sectionData);
            }
        });

        return this;
    }

    public addIncludeOnce(source:string, script:string):NodeBuilder{
        this._onIncludeOnce.push({source:source, script:script});
        return this;
    }

    public addIncludeEditPrepare(source:string, script:string):NodeBuilder{
        this._onIncludeEditPrepare.push({source:source, script:script});
        return this;
    }

    public addIncludeEditSave(source:string, script:string):NodeBuilder{
        this._onIncludeEditSave.push({source:source, script:script});
        return this;
    }

    public addIncludeEditCancel(source:string, script:string):NodeBuilder{
        this._onIncludeEditCancel.push({source:source, script:script});
        return this;
    }

    public addIncludeEditDelete(source:string, script:string):NodeBuilder{
        this._onIncludeEditDelete.push({source:source, script:script});
        return this;
    }

    public addIncludeEditForm(source:string, script:string):NodeBuilder{
        this._onIncludeEditForm.push({source:source, script:script});
        return this;
    }
    
    public addIncludeDocumentation(source:string, script:string):NodeBuilder{
        this._onIncludeDocumentation.push({source:source, script:script});
        return this;
    }

    public buildOnceHtml(): {source: string, html: string}[] {
        return this._onIncludeOnce.map(entry => ({
            source: entry.source,
            html: this.serializeHTML(entry.source, entry.script)
        }));
    }

    public buildDeferredType(): string {
        // Apply shadow defaults (same side-effect as buildType)
        let shaddowDefaults = Object.entries(this._defaults).filter(([name, template]) => template.type && template.type.endsWith("[]"));
        if (shaddowDefaults.length > 0) {
            this.addIncludeEditSave(this._name + "_shaddowDefaults",
                `{ let node = this; ` +
                    shaddowDefaults
                    .map(([name, template]) => `
                    for(let i = 0; i < ${template.maxInstances}; i++){
                        node["_${name}_" + i] = (node.${name}[i] || {}).proxy || "";
                    }`)
                    .join("\n\n") +
                `}`
            );
        }

        const registerTypeBody = `{
            category: '${this._category}',
            ${(this._category !== "config" && this._icon) ? `icon: '${this._icon}',` : ""}
            ${(this._category !== "config" && this._color) ? `color: '${this._color}',` : ""}
            ${(this._category !== "config" && this._labelStyle) ? `labelStyle: '${this._labelStyle}',` : ""}
            ${(this._label) ? `label: ${this._label},` : ""}
            ${this._paletteLabel ? `paletteLabel: '${this._paletteLabel}',` : ""}
            ${(this._category !== "config") ? `inputs:${this._inputs ? "1" : "0"},` : ""}
            ${(this._category !== "config") ? `inputLabels:(i) => '${this._inputs}',` : ""}
            ${(this._category !== "config") ? `outputs:${this._outputs.length},` : ""}
            ${(this._category !== "config") ? `outputLabels:(i) => ${this.serializeProperty(this._outputs)}[i],` : ""}
            defaults: {
                ${Object.entries(this._defaults).map(([key, value]) => this.serializeDefault(key, value)).join("\n")}
            },
            oneditprepare: function() {
                ${this._onIncludeEditPrepare.map(entry => this.serializeJavaScript(entry.source, entry.script)).join("")}
            },
            oneditsave: function() {
                ${this._onIncludeEditSave.map(entry => this.serializeJavaScript(entry.source, entry.script)).join("")}
            },
            oneditcancel: function() {
                ${this._onIncludeEditCancel.map(entry => this.serializeJavaScript(entry.source, entry.script)).join("")}
            },
            oneditdelete: function() {
                ${this._onIncludeEditDelete.map(entry => this.serializeJavaScript(entry.source, entry.script)).join("")}
            },
        }`;

        return getBeautify().html_beautify(`
        <script type="text/javascript">
        (function () {
            RED.events.on('registry:node-set-added', function (ns) {
                if (ns.types && ns.types.indexOf('${this._name}') !== -1) {
                    RED.nodes.registerType('${this._name}', ${registerTypeBody});
                }
            });
        }());
        </script>`, beautifyOptions);
    }

    private serializeProperty(value:any):string{
        switch(typeof value){
            case "boolean": {
                return "" + value;
            }
            case "number": {
                return "" + value;
            }
            case "string": {
                return `'${value}'`
            }
            case "function": {
                return (value as Function).toString();
            }
            case "object": {
                if(Array.isArray(value)){
                    return `[${(value as []).map(t => this.serializeProperty(t)).join(", ")}]`
                }
            }
        }
        throw new Error(`no serializeProperty handler for ${typeof value}, ${value}`)
    }


    private serializeHTML(source:string, script:string):string{ 
        let context = {
            defaults: (this._category === "config") 
                ? Object.fromEntries(Object.keys(this._defaults).map(k => [k, `node-config-input-${k}`]))
                : Object.fromEntries(Object.keys(this._defaults).map(k => [k, `node-input-${k}`]))
        }

        return `<!-- ${source} -->
        ${getHandlebars().compile(script)(context)}
        `
    }

    private serializeJavaScript(source:string, script:string):string{
        let context = {
            defaults: (this._category === "config")
                ? Object.fromEntries(Object.keys(this._defaults).map(k => [k, `node-config-input-${k}`]))
                : Object.fromEntries(Object.keys(this._defaults).map(k => [k, `node-input-${k}`]))
        }

        let serialized = getHandlebars().compile(script)(context).trim();
        if(!serialized.startsWith("{") && !serialized.endsWith("}")){
            serialized = "{\n" + serialized + "\n}";
        }

        return `// **** ${source} **** //
        ${serialized}
        `
    }

    private serializeFormEntry(source:string, script:string):string{
        let context = {
            defaults: (this._category === "config")
                ? Object.fromEntries(Object.keys(this._defaults).map(k => [k, `node-config-input-${k}`]))
                : Object.fromEntries(Object.keys(this._defaults).map(k => [k, `node-input-${k}`]))
        }
        return `
            <div id='section_${source}'>${getHandlebars().compile(script)(context)}
            </div>
        `
    }

    private serializeDefault(name: string, value: any): String { 
        return  `${name}: { ${Object.entries(value).map(([k,v]) => `${k}:${this.serializeProperty(v)}`).join(", ")} },`;
    }
    
    private serializeDocumentationEntry(source: string, script: string): String {
        return script;
    }

    public buildType():string{ 
        // compose the shaddow defaults if need be.
        let shaddowDefaults = Object.entries(this._defaults).filter(([name, template]) => template.type && template.type.endsWith("[]"));
        if(shaddowDefaults.length > 0){
            this.addIncludeEditSave(this._name + "_shaddowDefaults", 
                `{ let node = this; ` + 
                    shaddowDefaults
                    .map(([name, template]) => `
                    for(let i = 0; i < ${template.maxInstances}; i++){
                        node["_${name}_" + i] = (node.${name}[i] || {}).proxy || "";
                    }`)
                    .join("\n\n") + 
                `}`
            );
        }

        return getBeautify().html_beautify(`
        ${this._onIncludeOnce.map(entry => this.serializeHTML(entry.source, entry.script)).join("")}
        <script type="text/javascript">
            RED.nodes.registerType('${this._name}',{      
                category: '${this._category}',
                ${(this._category !== "config" && this._icon) ? `icon: '${this._icon}',` : ""}
                ${(this._category !== "config" && this._color) ? `color: '${this._color}',` : ""}
                ${(this._category !== "config" && this._labelStyle) ? `labelStyle: '${this._labelStyle}',` : ""}
                ${(this._label) ? `label: ${this._label},` : ""}
                ${this._paletteLabel ? `paletteLabel: '${this._paletteLabel}',` : ""}
                ${(this._category !== "config") ? `inputs:${this._inputs ? "1" : "0"},` : ""}
                ${(this._category !== "config") ? `inputLabels:(i) => '${this._inputs}',` : ""}
                ${(this._category !== "config") ? `outputs:${this._outputs.length},` : ""}
                ${(this._category !== "config") ? `outputLabels:(i) => ${this.serializeProperty(this._outputs)}[i],` : ""}
                defaults: {
                    ${Object.entries(this._defaults).map(([key, value]) => this.serializeDefault(key, value)).join("\n")}
                },
                oneditprepare: function() {
                    ${this._onIncludeEditPrepare.map(entry => this.serializeJavaScript(entry.source, entry.script)).join("")}
                },
                oneditsave: function() {
                    ${this._onIncludeEditSave.map(entry => this.serializeJavaScript(entry.source, entry.script)).join("")}
                },
                oneditcancel: function() {
                    ${this._onIncludeEditCancel.map(entry => this.serializeJavaScript(entry.source, entry.script)).join("")}
                },
                oneditdelete: function() {
                    ${this._onIncludeEditDelete.map(entry => this.serializeJavaScript(entry.source, entry.script)).join("")}
                },
            });
        </script>`, beautifyOptions);
    };

    public buildHtml():string{
        return getBeautify().html_beautify(`
        <script type="text/html" data-template-name='${this._name}'>
            ${this._onIncludeEditForm.map(entry => this.serializeFormEntry(entry.source, entry.script)).join("")}
        </script>
        `);
    }

    public buildDocumentation():string{
        return [
            `<script type="text/markdown" data-help-name='${this._name}'>`,
            this._onIncludeDocumentation.map(entry => this.serializeDocumentationEntry(entry.source, entry.script)).join("").trim(),
            `</script>`
        ].join("\n")
    }
;

};

let evalInContext = (context: any, js: string) => {
    const contextKeys = Object.keys(context);
    const contextValues = Object.values(context);

    // For scripts, we don't wrap in return() - just execute the code directly
    try{
        const func = new Function(...contextKeys, js);
        return func(...contextValues);
    }
    catch(error){
        console.log("Error while evaluating onCompose Script for ", context, error);
        throw error;
    }
};

let buildNodeBuilder = function(node: INodeClass): NodeBuilder {
    // get the node descriptor and create the builder.
    let nodeDescriptor = node.getNodeDescriptor();
    let nodeBuilder = new NodeBuilder(nodeDescriptor.id(), nodeDescriptor.group());

    // load the html source file
    let uiDom = new (getJSDOM())(fs.readFileSync(nodeDescriptor.sourceFile()));

    // apply the onCompose section if available.
    let onCompose = uiDom.window.document.querySelector("script[template-section='onCompose']")?.innerHTML;
    if(onCompose){
        evalInContext({ node:nodeBuilder }, onCompose.toString()!);
    }

    // load the other sections and add them as needed.
    let sections:string[] = ['IncludeOnce', 'IncludeEditPrepare', 'IncludeEditSave', 'IncludeEditCancel', 'IncludeEditDelete', 'IncludeEditForm', 'IncludeDocumentation'];
    Object.values(sections).forEach(section => {
        let sectionData = uiDom.window.document.querySelector(`[template-section='on${section}']`)?.innerHTML;
        if(sectionData){
            (nodeBuilder as any)[`add${section}`](nodeDescriptor.id(), sectionData);
        }
    });

    // add some of the dependencies here.
    nodeDescriptor.templates().forEach(template => nodeBuilder.addTemplate(template));

    return nodeBuilder;
}

let buildNode = function(node:INodeClass){
    let nodeBuilder = buildNodeBuilder(node);
    return [nodeBuilder.buildType(), nodeBuilder.buildHtml(), nodeBuilder.buildDocumentation()].join("\n\n");
}

export {
    buildNode,
    buildNodeBuilder
}
