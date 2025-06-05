import { NodeAPI, NodeAPISettingsWithData } from "node-red"
import { BaseNode, BaseNodeConfig, NodeManager, Template, TemplateDescriptor } from "../../NodeConstructor"
import { SourceUtility } from "../../NodeGenerator";

export class SettingsTemplate extends Template {


    
    public static getTemplateDescriptor(): TemplateDescriptor {
        return new TemplateDescriptor(
            "settings", 
            SettingsTemplate, 
            SourceUtility.getSourcePath("/build/", "/src/") + "SettingsTemplate.html",
            []
        );    
    }
}
