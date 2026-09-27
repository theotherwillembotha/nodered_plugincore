import { Node } from "node-red";
import { ConfigNodeConfig } from "../../NodeConstructor";
import { NodeDescription } from "../../tagging/NodeDescriptionDecorator";
import { SourceUtility } from "../../NodeGenerator";
import { StateService, StateHandle } from "../service/StateService";
import { StateConfigNode } from "./StateConfigNode";
import { ConfigFragmentService } from "../../configfragment/service/ConfigFragmentService";

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

    constructor(node: Node, config: ConfigNodeConfig) {
        super(node, config);
    }

    public createHandle(): StateHandle {
        return new InternalStateHandle(this.id(), false, false);
    }
}

// ── Type-based factory (for fragment-based StateTemplate v0.4.5+) ──

StateService.registerTypeFactory("InternalStateConfigNode", (ownerId: string, config: any, _providerRef: string) => {
    const survivesRedeploy = config.survivesRedeploy ?? false;
    const survivesRestart  = config.survivesRestart  ?? false;
    StateService.registerConfig(ownerId, { survivesRedeploy, survivesRestart });
    return new InternalStateHandle(ownerId, survivesRedeploy, survivesRestart);
});

// ── ConfigFragment registration ──

const INTERNAL_STATE_FRAGMENT_HTML = `
<script type="application/json" fragment-section="metaData">
{ "label": "Persistence" }
</script>

<script type="text/html" fragment-section="onForm">
    <div class="form-row nomargin">
        <label class="towb_editorlabel">&nbsp;</label>
        <input class="towb_checkbox" type="checkbox" id="fragment-survivesRedeploy" />
        <label class="towb_checkboxlabel" for="fragment-survivesRedeploy">Survives redeploy</label>
    </div>
    <div class="form-row nomargin">
        <label class="towb_editorlabel">&nbsp;</label>
        <input class="towb_checkbox" type="checkbox" id="fragment-survivesRestart" />
        <label class="towb_checkboxlabel" for="fragment-survivesRestart">Survives restart <span style="color:#aaa; font-size:0.85em;">(also writes to disk)</span></label>
    </div>
</script>

<script type="text/javascript" fragment-section="onLoad">
    var $c = $(container);
    $c.find("#fragment-survivesRedeploy").prop("checked", config.survivesRedeploy || false);
    $c.find("#fragment-survivesRestart").prop("checked", config.survivesRestart || false);

    $c.find("#fragment-survivesRestart").on("change", function() {
        if ($(this).prop("checked")) {
            $c.find("#fragment-survivesRedeploy").prop("checked", true).prop("disabled", true);
        } else {
            $c.find("#fragment-survivesRedeploy").prop("disabled", false);
        }
    }).trigger("change");
</script>

<script type="text/javascript" fragment-section="onSave">
    var $c = $(container);
    return {
        survivesRedeploy: $c.find("#fragment-survivesRedeploy").prop("checked"),
        survivesRestart:  $c.find("#fragment-survivesRestart").prop("checked")
    };
</script>
`;

ConfigFragmentService.registerFragment({
    section: 'StateConfig',
    providerType: 'InternalStateConfigNode',
    html: INTERNAL_STATE_FRAGMENT_HTML,
});
