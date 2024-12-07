import { LibraryItem, LibraryItemType } from "@/library";

export interface ScriptLibraryItemState {
    script: string;
}

export class ScriptLibraryItem extends LibraryItem<ScriptLibraryItemState> {
    public type = LibraryItemType.SCRIPT;
    public name = "Script";

    public script = "";

    public override save() {
        return {
            script: this.script,
        };
    }

    public override load(state: ScriptLibraryItemState) {
        this.script = state.script;
    }
}
