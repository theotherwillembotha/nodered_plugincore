import os from "os";
import { RestAuthType } from "../logger/service/LoggerService";
import { BaseNode, createPostConstructDecorator, NodeManager } from "../NodeConstructor";
import { HTTPScheme, ProxyManagerClient } from "./service/ReverseProxyTypeService";
import { ApiKeyAuthenticationConfig, BasicAuthenticationConfig, EndpointConfig, EndpointMethodType, NoAuthenticationConfig, WebhookServer } from "./service/WebhookServerService";
import { WebhookTemplateConfig } from "./template/WebhookTemplate";


type WebhookConfig = {
    name?:string,
    methods:EndpointMethodType[],
}

type ManagedProxyHost = {
    proxyNodeId: string;
    hostId: number;
}

// In-memory registry: nodeId → managed proxy host entries from the last deploy.
const managedProxyHosts = new Map<string, ManagedProxyHost[]>();

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

            let targetPort = webhookServer.config().port;
            let targetHost = os.hostname();
            let nodeId = nodeConfig.id;
            let newlyManaged: ManagedProxyHost[] = [];

            await Promise.all(nodeConfig.reverseProxies_connections.map(async proxy => {
                try{
                    // TODO: ReverseProxyConfigNodes need to become their own subtype of config nodes so we can enforce the ".client()" method.
                    let reverseProxyNode = (NodeManager.RED.nodes.getNode(proxy.proxy) as any).node();
                    let proxyClient = reverseProxyNode.client() as ProxyManagerClient;

                    let hosts = await proxyClient.getHosts();
                    let matchingHost = hosts.find(h => h.domainNames?.includes(proxy.domainname));

                    if (!matchingHost) {
                        await proxyClient.updateHost({ domainNames: [proxy.domainname], forwardHost: targetHost, forwardPort: targetPort, scheme: HTTPScheme.HTTP });
                        // Fetch again to get the assigned ID of the newly created entry.
                        let updatedHosts = await proxyClient.getHosts();
                        matchingHost = updatedHosts.find(h => h.domainNames?.includes(proxy.domainname));
                    }
                    else if (matchingHost.forwardHost !== targetHost || matchingHost.forwardPort !== targetPort) {
                        await proxyClient.updateHost({ id: matchingHost.id, forwardHost: targetHost, forwardPort: targetPort, scheme: HTTPScheme.HTTP });
                    }

                    if (matchingHost?.id !== undefined) {
                        newlyManaged.push({ proxyNodeId: proxy.proxy, hostId: matchingHost.id });
                    }
                }
                catch(e){
                    console.error(e);
                }
            }));

            // Remove any stale proxy host entries that were managed last deploy but are no longer in the current config.
            let previouslyManaged = managedProxyHosts.get(nodeId) ?? [];
            let newHostIds = new Set(newlyManaged.map(m => m.hostId));

            await Promise.all(previouslyManaged
                .filter(m => !newHostIds.has(m.hostId))
                .map(async stale => {
                    try{
                        let reverseProxyNode = (NodeManager.RED.nodes.getNode(stale.proxyNodeId) as any).node();
                        let proxyClient = reverseProxyNode.client() as ProxyManagerClient;
                        await proxyClient.deleteHost(stale.hostId);
                    }
                    catch(e){
                        console.error(e);
                    }
                })
            );

            managedProxyHosts.set(nodeId, newlyManaged);
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