import { markRaw } from "vue";
import { NodeInterface } from "baklavajs";
// TODO:
// import { displayInSidebar } from "@baklavajs/renderer-vue/dist/sidebar";
import ScriptOption from "../options/script/ScriptOption.vue";
import type ScriptNode from "../nodes/scriptNode";

export class ScriptNodeConfigurationInterface extends NodeInterface<undefined> {
    constructor(public node: ScriptNode) {
        super("Configure", undefined);
        (this as any).displayInSidebar = true;
        this.setComponent(markRaw(ScriptOption));
    }
}
