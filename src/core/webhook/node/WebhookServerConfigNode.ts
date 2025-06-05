
import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig } from "../../NodeConstructor"
import { SourceUtility } from "../../NodeGenerator";
import { WebhookServer, WebhookServerService } from "../service/WebhookServerService";
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";

interface WebhookServerConfigNodeConfig extends ConfigNodeConfig {
    id: string;
    port: number;
    externalHost:string;
    externalPort:number;
}

@NodeDescription({
    id:"WebhookServerConfigNode",
    name:"Webhook Server Config Node",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "WebhookServerConfigNode.html",
    package: "@theotherwillembotha/nodered_plugincore",
    dependencies:[ WebhookServerService ],
    tags: [ "Core" ]
})
export class WebhookServerConfigNode extends ConfigNode<WebhookServerConfigNodeConfig> {
    private _server: WebhookServer;
    
    constructor(node: Node, config: WebhookServerConfigNodeConfig){
        super(node, config);
        let _this = this;

        // instantiate the webhook here.. or get a reference to it atleast.
        this._server = WebhookServerService.get(config);
    }

    public server():WebhookServer {
        return this._server;
    }
}
