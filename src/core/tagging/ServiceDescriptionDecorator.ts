import { DependencyType, ServiceDescriptor } from "../NodeConstructor";

export type ServiceDescriptionConfig = {
    id: string;
    sourceFile: string;
    type?: string;
    name?: string;
    dependencies?: DependencyType[];
}

export function ServiceDescription(config: ServiceDescriptionConfig) {
    return function(target: any) {
        const descriptor = new ServiceDescriptor(
            config.id,
            config.name ?? target.name,
            config.type ?? "services-plugin",
            config.sourceFile,
            target,
            config.dependencies
        );
        target.getServiceDescriptor = (): ServiceDescriptor => descriptor;
    };
}
