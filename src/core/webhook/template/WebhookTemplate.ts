import { BaseNodeConfig, Template, TemplateDescriptor } from "../../NodeConstructor"
import { WebhookServerConfigNode } from "../node/WebhookServerConfigNode";
import { SourceUtility } from "../../NodeGenerator";
import { ApiKeyMechanismType, RestAuthType } from "../../logger/service/LoggerServiceTypes";

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

export class WebhookTemplate extends Template {

    static getTemplateDescriptor(): TemplateDescriptor {
        return new TemplateDescriptor(
            "webhook", WebhookTemplate, 
            SourceUtility.getSourcePath("/build/", "/src/") + "WebhookTemplate.html",
            [WebhookServerConfigNode])        
    }
}



