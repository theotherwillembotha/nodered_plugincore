import { INodeClass } from "../../NodeGenerator";
import { BaseService, ConfigNode, FlowDeployment } from "../../NodeConstructor";
import { ServiceDescription } from "../ServiceDescriptionDecorator";
import { NodeAPI, NodeAPISettingsWithData } from "node-red";


@ServiceDescription({
    id: "@theotherwillembotha/nodetypeservice",
    sourceFile: "@theotherwillembotha/node-red-plugincore"
})
export class NodeTypeService extends BaseService {
    private red!: NodeAPI<NodeAPISettingsWithData>;
    private nodeTypes:{[key:string]:INodeClass[]} = {};

    constructor(){
        super("nodetypes")
    }

    public init(red: NodeAPI<NodeAPISettingsWithData>): void | Promise<void> {
        this.red = red;

        // update the config/
        this.red.httpAdmin.get("/nodetypeservice/find", this.red.auth.needsPermission("inject.write"), (request,response) => {
            let tag = request.query.tag as string;

            // serialize the types to a javascript friendly format
            let types = this.getNodeTypesForTag(tag).map( type => {
                let description = type.getNodeDescriptor();
                return {
                    "id": description.id(),
                    "name": description.name(),
                };
            })

            response.send(types);
        });

        return Promise.resolve();
    }

    public deinit(red: NodeAPI<NodeAPISettingsWithData>): void | Promise<void> {
        return Promise.resolve();
    }

    public onDeploy(flowDeployment: FlowDeployment): void | Promise<void> {
        
    }

    public registerNodeType(tag:string, resource: INodeClass): Promise<void> {
        let nodes = this.nodeTypes[tag];
        if(!nodes){
            this.nodeTypes[tag] = nodes = [];
        }
        nodes.push(resource);
        return Promise.resolve();
    }

    public getNodeTypesForTag(tag:string):INodeClass[] {
        return this.nodeTypes[tag] ? this.nodeTypes[tag] : [];
    }

}