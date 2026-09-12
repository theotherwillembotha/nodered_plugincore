import { DependencyType, TemplateDescriptor } from "../NodeConstructor";

export type TemplateDescriptionConfig = {
    name: string;
    templateFile: string;
    dependencies?: DependencyType[];
}

export function TemplateDescription(config: TemplateDescriptionConfig) {
    return function(target: any) {
        const descriptor = new TemplateDescriptor(
            config.name,
            target,
            config.templateFile,
            config.dependencies ?? []
        );
        target.getTemplateDescriptor = (): TemplateDescriptor => descriptor;
    };
}
