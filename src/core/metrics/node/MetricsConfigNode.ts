
import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig, NodeDescriptor } from "../../NodeConstructor"
import { MetricsContainer, MetricsService} from "../service/MetricsService"
import { SourceUtility } from "../../NodeGenerator";
import { WebhookTemplate, WebhookTemplateConfig } from "../../webhook/template/WebhookTemplate";
import { Webhook } from "../../webhook/WebhookDecorator";
import { EndpointMethodType } from "../../webhook/service/WebhookServerService";
import  {register as PrometheusRegistry, } from "prom-client";
import express, { Request, Response, Express } from 'express';
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";

/*
Note: the MetricsConfigNode does not actually do the deployment of the metrics / repositories.
The metrics / repositories are menanaged by the plugin and triggered when the flows are deployed.

The reasoning for this is that the Metrics exist outside of the flow, but is configured using the flow.
Basically, if the metrics arent changed, we dont have to redeploy the metrics, which means that
stuff like coutners, guages and timers are not reset.
*/
interface MetricsConfigNodeConfig extends ConfigNodeConfig, WebhookTemplateConfig {
}

@NodeDescription({
    id:"MetricsConfigNode",
    name:"Metrics Config Node",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "MetricsConfigNode.html",
    package: "@theotherwillembotha/node-red-plugincore",
    templates:[
        { template:WebhookTemplate, config: {} }
    ],
    dependencies:[ MetricsService ],
    tags: [ ]
})
export class MetricsConfigNode extends ConfigNode<MetricsConfigNodeConfig> {
    private _metrics!: MetricsContainer;

    constructor(node: Node, config: MetricsConfigNodeConfig){
        super(node, config);
        let _this = this;

        this._metrics = MetricsService.get({metricsEnabled:false, metricsReference:this.id()});
    }

    public metrics():MetricsContainer {
        return this._metrics;
    }

    @Webhook({name:"MetricsConfigNode", methods:[EndpointMethodType.GET]})
    private onWebhookRequest(request:Request, response:Response):void {
        response.set('Content-Type', PrometheusRegistry.contentType);
        this._metrics.registry().metrics().then((data:any) => response.status(200).send(data))
    }
}
