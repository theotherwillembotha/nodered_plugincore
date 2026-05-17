import { RestAuthType } from "../logger/service/LoggerService";
import { BaseNode, createPostConstructDecorator, NodeManager } from "../NodeConstructor";
import { ProxyManagerClient } from "./service/ReverseProxyTypeService";
import { ApiKeyAuthenticationConfig, BasicAuthenticationConfig, EndpointConfig, EndpointMethodType, NoAuthenticationConfig, WebhookServer } from "./service/WebhookServerService";
import { WebhookTemplateConfig } from "./template/WebhookTemplate";


type WebhookConfig = {
    name?:string,
    methods:EndpointMethodType[],
}

const Webhook = createPostConstructDecorator<WebhookConfig>('Webhook')
    .withInitLogic(async (instance, propertyKey, webhookconfig:WebhookConfig) => {
        //console.log(`Registering webhook callback`,  "PROPERTYKEY", propertyKey, "WEBHOOK CONFIG", webhookconfig, "THIS", this);
        
        let node = instance as BaseNode<WebhookTemplateConfig>;
        let nodeConfig = node.config();

        // create the authentication.
        let authentication =
            (nodeConfig.webhookAuth === RestAuthType.basic) ? {type:RestAuthType.basic, username:nodeConfig.webhookAuth_basic_username, password: nodeConfig.webhookAuth_basic_password} as BasicAuthenticationConfig :
            (nodeConfig.webhookAuth === RestAuthType.apikey) ? {type:RestAuthType.apikey, mechanism:nodeConfig.webhookAuth_apikey_mechanism, key:nodeConfig.webhookAuth_apikey_key, value: nodeConfig.webhookAuth_apikey_value } as ApiKeyAuthenticationConfig :
            {type:RestAuthType.none} as NoAuthenticationConfig;

        // register a callback listener to the webserver.
        let endpointConfig:EndpointConfig = {
            path: nodeConfig.webhookPath,
            methods: webhookconfig.methods,
            authentication: authentication
        }

        let webhookServer:WebhookServer = (NodeManager.RED.nodes.getNode(nodeConfig.webhook) as any).node().server();
        webhookServer.attach(endpointConfig, (request, respponse) => instance[propertyKey](request, respponse));

        if(nodeConfig.reverseProxies_enabled){

            await Promise.all(nodeConfig.reverseProxies_connections.map(async proxy => {

                try{
                    // get a n instance of reverseProxNode.
                    let reverseProxyNode = (NodeManager.RED.nodes.getNode(proxy.proxy) as any).node();

                    // TODO: ReverseProxyConfigNodes need to become their own subtype of config nodes so we can enforce the ".client()" method.
                    let proxyClient = reverseProxyNode.client() as ProxyManagerClient;

                    console.log("List of known hosts: ", await proxyClient.getHosts());
                    //console.log("ADD REVERSE PROXY:" + proxy.proxy + " to " + node.id(), proxyClient);
                }
                catch(e){
                    console.log(e);
                }

                return Promise.resolve();
            }));
        }

        // register a close listener to the node.
        node.node().on("close", () => {
            webhookServer.detach(endpointConfig);
        })
    })
    .build();


export {
    Webhook
}