import { Node } from "node-red";
import { ConfigNodeConfig } from "../../NodeConstructor";
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";
import { SourceUtility } from "../../NodeGenerator";
import { StateService, StateHandle } from "../service/StateService";
import { StateConfigNode } from "./StateConfigNode";

interface InternalStateConfigNodeConfig extends ConfigNodeConfig {
    survivesRedeploy: boolean;
    survivesRestart: boolean;
}

class InternalStateHandle implements StateHandle {
    private _nodeId: string;
    private _survivesRedeploy: boolean;
    private _survivesRestart: boolean;
    private _callback: ((s: string) => void) | null = null;

    constructor(nodeId: string, survivesRedeploy: boolean, survivesRestart: boolean) {
        this._nodeId = nodeId;
        this._survivesRedeploy = survivesRedeploy;
        this._survivesRestart = survivesRestart;
        this._init();
    }

    private _init(): void {
        // On process restart, memory is empty. If this node survives restarts, load from file.
        if (this._survivesRestart && StateService.getMemory(this._nodeId) === null) {
            const fileValue = StateService.readFile(this._nodeId);
            if (fileValue !== null) {
                StateService.setMemory(this._nodeId, fileValue);
            }
        }
        // Default state seeding is the consumer node's responsibility - call set() after get() returns null.
    }

    private _read(): string | null {
        return StateService.getMemory(this._nodeId);
    }

    private _write(value: string): void {
        StateService.setMemory(this._nodeId, value);
        if (this._survivesRestart) {
            StateService.writeFile(this._nodeId, value);
        }
    }

    public get(): Promise<string | null> {
        return Promise.resolve(this._read());
    }

    public set(stateName: string): Promise<void> {
        this._write(stateName);
        StateService.notifySubscribers(this._nodeId, stateName);
        return Promise.resolve();
    }

    public subscribe(callback: (stateName: string) => void): void {
        this._callback = callback;
        StateService.addSubscriber(this._nodeId, callback);
    }

    public unsubscribe(): void {
        if (this._callback) {
            StateService.removeSubscriber(this._nodeId, this._callback);
            this._callback = null;
        }
    }
}

@NodeDescription({
    id: "InternalStateConfigNode",
    name: "Internal State Config Node",
    group: "config",
    sourceFile: SourceUtility.getSourcePath("/build/", "/src/") + "InternalStateConfigNode.html",
    package: "@theotherwillembotha/node-red-plugincore",
    dependencies: [StateService],
    tags: ["StateProvider"]
})
export class InternalStateConfigNode extends StateConfigNode {
    private _survivesRedeploy: boolean;
    private _survivesRestart: boolean;

    constructor(node: Node, config: InternalStateConfigNodeConfig) {
        super(node, config);
        this._survivesRedeploy = config.survivesRedeploy ?? false;
        this._survivesRestart  = config.survivesRestart  ?? false;

        StateService.registerConfig(config.id, {
            survivesRedeploy: this._survivesRedeploy,
            survivesRestart:  this._survivesRestart,
        });
    }

    public createHandle(): StateHandle {
        return new InternalStateHandle(
            this.id(),
            this._survivesRedeploy,
            this._survivesRestart
        );
    }
}
