import { NodeAPI, NodeAPISettingsWithData } from "node-red"
import { Template, TemplateDescriptor } from "../../NodeConstructor"
import { SourceUtility } from "../../NodeGenerator";

export class BasicTemplate extends Template {

  public static getTemplateDescriptor(): TemplateDescriptor {
    return new TemplateDescriptor(
      "basic", 
      BasicTemplate,
      SourceUtility.getSourcePath("/build/", "/src/") + "BasicTemplate.html",
      []
    );   
  }
}
