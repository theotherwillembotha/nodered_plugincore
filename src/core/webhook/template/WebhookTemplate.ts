import { BaseNodeConfig, Template } from "../../NodeConstructor"
import { SourceUtility } from "../../NodeGenerator";
import { TemplateDescription } from "../../tagging/TemplateDescriptionDecorator";
import { DelegatedConfigReferenceNode } from "../../other/node/DelegatedConfigReferenceNode";
import { WebhookServerConfigNode } from "../node/WebhookServerConfigNode";
import { WebhookServerService } from "../service/WebhookServerService";
import { RestAuthType, ApiKeyMechanismType } from "../../logger/service/LoggerService";

export interface WebhookTemplateConfig extends BaseNodeConfig{
    webhook:string,
    webhookPath:string,
    webhookAuth:RestAuthType,
    webhookAuth_basic_username:string,
    webhookAuth_basic_password:string,
    webhookAuth_apikey_mechanism:ApiKeyMechanismType,
    webhookAuth_apikey_key:string,
    webhookAuth_apikey_value:string,

    reverseProxies_enabled:boolean,
    reverseProxies_connections:ReverseproxyConnection[],
}

export type ReverseproxyConnection = {
    proxy:string,
    domainname:string
}

@TemplateDescription({
    name: "webhook",
    templateFile: SourceUtility.getSourcePath("/build/", "/src/") + "WebhookTemplate.html",
    dependencies: [DelegatedConfigReferenceNode, WebhookServerConfigNode, WebhookServerService],
})
export class WebhookTemplate extends Template {
}
