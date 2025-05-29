import { LibraryItem, LibraryItemType } from "@/library";

export interface ScriptLibraryItemState {
    script: string;
}

const DEFAULT_SCRIPT_CONTENT = `export default class MyScript implements LMSScript {
  public tick(data: LMSCalculationData) {
    // Your code here
  }
}`;

export class ScriptLibraryItem extends LibraryItem<ScriptLibraryItemState> {
    public type = LibraryItemType.SCRIPT;
    public name = "Script";

    public script = DEFAULT_SCRIPT_CONTENT;

    private compiledScript?: LMSScript | undefined;

    public override save() {
        return {
            script: this.script,
        };
    }

    public override load(state: ScriptLibraryItemState) {
        this.script = state.script;
    }

    public setCompiledScript(compiledScript: any) {
        this.compiledScript = compiledScript;
    }

    public async activate() {
        try {
            await this.compiledScript?.activate?.();
            this.error = "";
        } catch (err) {
            console.error(err);
            this.error = String(err);
        }
    }

    public async run(data: LMSCalculationData) {
        try {
            await this.compiledScript?.tick?.(data);
            this.error = "";
        } catch (err) {
            console.error(err);
            this.error = String(err);
        }
    }

    public async deactivate() {
        try {
            await this.compiledScript?.deactivate?.();
            this.error = "";
        } catch (err) {
            console.error(err);
            this.error = String(err);
        }
    }
}
