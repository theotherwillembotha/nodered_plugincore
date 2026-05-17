import { BaseService, FlowDeployment, ServiceDescriptor } from "../../NodeConstructor";
import { NodeAPI, NodeAPISettingsWithData } from "node-red";

export abstract class ReverseProxyType {

    private _id: string;
    private _name: string;
    
    constructor(id:string, name:string){
        this._id = id;
        this._name = name;
    }

    public id():string {
        return this._id;
    }
    public name():string {
        return this._name;
    }
}

export interface ProxyManagerClient {
    updateHost(data: Partial<HostEntry>):Promise<void>;
    getHosts():Promise<Partial<HostEntry>[]>;
}

export type HostEntry = {
    id:number,
    domainNames:string[],
    scheme:HTTPScheme,
    forwardHost:string,
    forwardPort:number,
    accessList:string,
    cacheAssets:boolean,
    blockCommonExploits:boolean,
    websocketSupport:boolean,
}

export enum HTTPScheme{
    HTTP = "http",
    HTTPS = "https"
}