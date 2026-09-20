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

const PROXY_RETRY_ATTEMPTS = 5;
const PROXY_RETRY_INTERVAL_MS = 2000;

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function resolveProxyNode(proxyId: string): any | null {
    let rawNode = NodeManager.RED.nodes.getNode(proxyId) as any;
    return rawNode ? rawNode.node() : null;
}

async function resolveProxyNodeWithRetry(proxyId: string): Promise<any | null> {
    for (let attempt = 1; attempt <= PROXY_RETRY_ATTEMPTS; attempt++) {
        let resolved = resolveProxyNode(proxyId);
        if (resolved) return resolved;
        if (attempt < PROXY_RETRY_ATTEMPTS) {
            console.warn(`Reverse proxy config node "${proxyId}" not available yet (attempt ${attempt}/${PROXY_RETRY_ATTEMPTS}), retrying in ${PROXY_RETRY_INTERVAL_MS}ms...`);
            await delay(PROXY_RETRY_INTERVAL_MS);
        }
    }
    console.error(`Reverse proxy config node "${proxyId}" not available after ${PROXY_RETRY_ATTEMPTS} attempts — giving up.`);
    return null;
}

async function setupReverseProxies(nodeConfig: WebhookTemplateConfig, webhookServer: WebhookServer): Promise<void> {
    let targetPort = webhookServer.config().port;
    let targetHost = os.hostname();
    let nodeId = nodeConfig.id;
    let newlyManaged: ManagedProxyHost[] = [];

    await Promise.all(nodeConfig.reverseProxies_connections.map(async proxy => {
        try {
            // TODO: ReverseProxyConfigNodes need to become their own subtype of config nodes so we can enforce the ".client()" method.
            let reverseProxyNode = await resolveProxyNodeWithRetry(proxy.proxy);
            if (!reverseProxyNode) return;
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
        catch (e) {
            console.error(e);
        }
    }));

    // Remove any stale proxy host entries that were managed last deploy but are no longer in the current config.
    let previouslyManaged = managedProxyHosts.get(nodeId) ?? [];
    let newHostIds = new Set(newlyManaged.map(m => m.hostId));

    await Promise.all(previouslyManaged
        .filter(m => !newHostIds.has(m.hostId))
        .map(async stale => {
            try {
                let reverseProxyNode = resolveProxyNode(stale.proxyNodeId);
                if (!reverseProxyNode) {
                    console.warn(`Stale reverse proxy config node "${stale.proxyNodeId}" not found — skipping cleanup.`);
                    return;
                }
                let proxyClient = reverseProxyNode.client() as ProxyManagerClient;
                await proxyClient.deleteHost(stale.hostId);
            }
            catch (e) {
                console.error(e);
            }
        })
    );

    managedProxyHosts.set(nodeId, newlyManaged);
}

const Webhook = createPostConstructDecorator<WebhookConfig>('Webhook')
    .withInitLogic(async (instance, propertyKey, webhookconfig:WebhookConfig) => {

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
            // Reverse proxy nodes from other packages may not be initialized yet.
            // Fire-and-forget: retry resolution up to 5 times at 2s intervals without blocking webhook startup.
            setupReverseProxies(nodeConfig, webhookServer);
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