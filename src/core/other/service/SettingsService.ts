import {BaseNode, BaseNodeConfig, BaseService, NodeManager} from "../../NodeConstructor"
import { ServiceDescription } from "../../tagging/ServiceDescriptionDecorator";
import { Node, NodeAPI, NodeDef, NodeAPISettingsWithData} from "node-red";

@ServiceDescription({
    id: "@theotherwillembotha/settingsservice",
    sourceFile: "@theotherwillembotha/node-red-plugincore"
})
export class SettingsService extends BaseService {

    static create(node:BaseNode<BaseNodeConfig>, config:SettingsConfig): Settings{
        // load the settings from the settings file.
        let settings = NodeManager.RED.settings.get("NodeSettings_" + config.id);
        //console.log("Retriving Settings for: " + "NodeSettings_" + config.id + " value: " + JSON.stringify(settings));
        if(settings === undefined){
            settings = {};
        }

        return new Settings(settings, config);
    }

    public constructor(){
        super("SettingsService");
    }

    public init(red: NodeAPI<NodeAPISettingsWithData>): void {

        red.httpAdmin.post("/utils/getNodeSettings", red.auth.needsPermission("inject.write"), async function(request,response) {
            let config = request.body;
        
            // get the settings for the node.
            let settings = red.settings.get("NodeSettings_" + config.nodeId);
        
            // send the response.
            response.send({
                status: "ok",
                settings: settings
            })
        });
    }

    public deinit(red: NodeAPI<NodeAPISettingsWithData>): void {
        red.httpAdmin.post("/utils/getNodeSettings", red.auth.needsPermission("inject.write"), async function(request,response) {
            response.status(404);
        });
    }

}

export class Settings{

    private _settings:any;
    private _config:any;

    constructor(settings:SettingsConfig, config:SettingsConfig){
        this._settings = settings;
        this._config = config;

        // if config unchanged, we can update the settings version.
        if(!this.hasChanged()){
            Object.keys(this._settings).forEach(key => this._config[key] = this._settings[key]);
        }
    }

    value(key:string):any{
        return this._settings[key];
    }

    values():any{
        return this._settings;
    }

    update(key:string, value:any){
        this._settings[key] = value;
    }

    updateAll(value:any){
        this._settings = value;
    }

    // the settings are considdered changed if the settingsTimestamp value is different;
    hasChanged():boolean{
        return (this._settings.settingsTimestamp !== this._config.settingsTimestamp);
    }

    persist() {
        NodeManager.RED.settings.set("NodeSettings_" + this._config.id, this._settings);
        //console.log("Persisted Settings for: " + "NodeSettings_" + this._config.id + " value: " + JSON.stringify(this._settings));
    }

    delete(){
        NodeManager.RED.settings.delete("NodeSettings_" + this._config.id);
        //console.log("Deleted Settings for: " + "NodeSettings_" + this._config.id + " value: " + JSON.stringify(this._settings));
    }
}

export interface SettingsConfig extends BaseNodeConfig {
    settingsTimestamp:number
}
