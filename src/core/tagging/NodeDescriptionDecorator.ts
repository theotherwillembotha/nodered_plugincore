import { NodeDependencyType, NodeDescriptor, TemplateConfig } from "../NodeConstructor";
import { ITemplateClass } from "../NodeGenerator";

export type NodeDescriptionConfig = {
    id: string;
    name:string,
    group: string;
    sourceFile: string;
    package: string;
    templates?: {template:ITemplateClass, config:TemplateConfig}[];
    dependencies?: NodeDependencyType[];
    tags?:string[];
}

export function NodeDescription(config:NodeDescriptionConfig) {
    return function(target: any) {
        let descriptor:NodeDescriptor = new NodeDescriptor(config.group, config.id, config.sourceFile, config.package);
        
        if(config.templates){
            for(let template of config.templates){
                descriptor.addTemplate(template.template, template.config);
            }
        }

        if(config.tags){
            for(let tag of config.tags){
                descriptor.addTag(tag);
            }
        }

        if(config.dependencies){
            for(let dependency of config.dependencies){
                descriptor.addDependency(dependency);
            }
        }

        target.getNodeDescriptor = (): NodeDescriptor => descriptor;
    };
}
