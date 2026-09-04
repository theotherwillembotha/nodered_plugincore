
import {BaseService, FlowDeployment} from "../../NodeConstructor";
import { ServiceDescription } from "../../tagging/ServiceDescriptionDecorator";
import { NodeAPI, NodeAPISettingsWithData } from "node-red";
import { WebhookServerConfigNode } from "../node/WebhookServerConfigNode";
import { WebhookTemplate } from "../template/WebhookTemplate";
import type { Express, Request, Response } from "express";
import { Server } from "http";
import { ApiKeyMechanismType, RestAuthType } from "../../logger/service/LoggerService";

function getExpress(): any { return require('express'); }
function getBodyParser(): any { return require('body-parser'); }

export enum EndpointMethodType {
    GET = "GET",
    POST = "POST",
}

export type NoAuthenticationConfig = {
    type:RestAuthType.none;
}

export type BasicAuthenticationConfig = {
    type:RestAuthType.basic
    username:string;
    password:string;
}

export type ApiKeyAuthenticationConfig = {
    type:RestAuthType.apikey,
    mechanism:ApiKeyMechanismType,
    key:string;
    value:string;
}

export type EndpointConfig = {
    path: string;
    methods:EndpointMethodType[];
    authentication: NoAuthenticationConfig | BasicAuthenticationConfig | ApiKeyAuthenticationConfig;
}

export class WebhookServer {
    
    private _config: WebhookServerConfig;
    private _app: Express;
    private _listener: Server;
    
    public constructor(config:WebhookServerConfig){
        this._config = config;

        this._app = getExpress()();
        this._app.use(getBodyParser().json({type: "application/json", limit: '50mb'}));
        this._listener = this._app.listen(this._config.port, '0.0.0.0');
    }

    public attach(endpoint:EndpointConfig, callback:(request:Request, response:Response) => any){

        let authenticator:((request:Request, response:Response) => Promise<boolean>);
        
        if(endpoint.authentication.type === RestAuthType.none){
            authenticator = (request, response) => Promise.resolve(true);
        }
        
        if(endpoint.authentication.type === RestAuthType.basic){
            let header = "Basic " + Buffer.from(`${endpoint.authentication.username}:${endpoint.authentication.password}`).toString("base64");
            authenticator = (request, response) => {
                return Promise.resolve(header === request.headers.authorization);
            }
        }
        
        if(endpoint.authentication.type === RestAuthType.apikey){
            let auth = endpoint.authentication as ApiKeyAuthenticationConfig;
            authenticator = (request, response) => {
                if(auth.mechanism === ApiKeyMechanismType.header){
                    return Promise.resolve(request.headers[auth.key] === auth.value)
                }
                console.log("No APIKEY Authentication Handler Implementation for Type: " + auth.mechanism);
                return Promise.resolve(false);
            }
        }

        let handlerChain = (request:Request, response:Response) => authenticator(request, response)
        .then(result => {
            if(result) {
                callback(request, response);
            }
            else{
                response.status(401).send()
            }
        });

        if(endpoint.methods.includes(EndpointMethodType.GET)){
            this._app.get(endpoint.path, handlerChain);
        }

        if(endpoint.methods.includes(EndpointMethodType.POST)){
            this._app.post(endpoint.path, handlerChain);
        }

    }

    public detach(configuration:EndpointConfig){
        configuration.methods.forEach(method => {
            this._app.router.stack = this._app.router.stack.filter(layer => {
                // if the path doesnt match, keep it.
                if(layer.route?.path !== configuration.path){
                    return true;
                }
                switch(method){
                    case EndpointMethodType.GET:{
                        return !(layer.route as any)?.methods.get
                    }
                    case EndpointMethodType.POST:{
                        return !(layer.route as any)?.methods.post
                    }
                };
            })
        });

    }

    public close(): void {
        this._listener.close();
    }

    public config():WebhookServerConfig {
        return this._config;
    }
}

export type  WebhookServerConfig = {
    id:string
    port: number;
    externalHost:string;
    externalPort:number;
}

// Stored on global so all bundled copies share the same server registry.
const _GLOBAL_WEBHOOKSERVERS_KEY = '__plugincore_webhookservers__';
function getWebhookServersStore(): {[key:string]:WebhookServer} {
    if (!(global as any)[_GLOBAL_WEBHOOKSERVERS_KEY]) (global as any)[_GLOBAL_WEBHOOKSERVERS_KEY] = {};
    return (global as any)[_GLOBAL_WEBHOOKSERVERS_KEY];
}

@ServiceDescription({
    id: "@theotherwillembotha/webhookserverservice",
    sourceFile: "@theotherwillembotha/node-red-plugincore",
    dependencies: [WebhookServerConfigNode, WebhookTemplate]
})
export class WebhookServerService extends BaseService {

    constructor(){
        super("wehbookserver")
    }

    public init(red: NodeAPI<NodeAPISettingsWithData>): void | Promise<void> {
        return Promise.resolve();
    }

    public deinit(red: NodeAPI<NodeAPISettingsWithData>): void | Promise<void> {
        return Promise.resolve();
    }

    public onDeploy(flowDeployment: FlowDeployment): void | Promise<void> {
        let removedServers:WebhookServerConfig[] = []
        let addedServers:WebhookServerConfig[] = []

        let webhookServerNodes = flowDeployment.flows.filter(node => node.type === "WebhookServerConfigNode") as any as WebhookServerConfig[];

        const store = getWebhookServersStore();

        // find all the nodes that have been removed or changed.
        Object.entries(store).forEach(([key, serverService]) => {
            let webhookServerNode = webhookServerNodes.find(node => node.id === key);
            let serverServiceConfig = serverService.config();
            // compare the properties.
            if(!webhookServerNode){
                // the node has been removed: TODO: alert the listeners that it has been removed.
                removedServers.push(serverServiceConfig);
            }
            else{
                // check if the node has changed at all.
                let serviceChanged = 
                    webhookServerNode.port !== serverServiceConfig.port || 
                    webhookServerNode.externalHost !== serverServiceConfig.externalHost || 
                    webhookServerNode.externalPort !== serverServiceConfig.externalPort;
                
                if(serviceChanged){
                    // TODO: notify the subscribers that the server has chaned.
                    removedServers.push(serverServiceConfig);
                    addedServers.push(webhookServerNode);
                }
            }
        });

        // find all the servers that have been added.
        webhookServerNodes
            .filter(node => !store[node.id])
            .forEach(node => addedServers.push(node));

        // Close and remove servers that have been deleted or whose config changed.
        removedServers.forEach(removedConfig => {
            const server = store[removedConfig.id];
            if (server) {
                server.close();
                delete store[removedConfig.id];
                console.log(`Closed webhook server on port ${removedConfig.port}`);
            }
        });
    }

    public static get (config:WebhookServerConfig): WebhookServer{
        const store = getWebhookServersStore();
        let server = store[config.id];
        if(!server){
            store[config.id] = server = new WebhookServer(config);
            console.log(`Creating webhook server on port ${config.port}`);
        }
        return server;
    }

}
