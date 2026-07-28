import { LibraryItem, LibraryItemType } from "@/library";
import { scriptRuntime } from "./api/runtime";
import { SequenceDefinition, SequenceInstance, SequenceTickInfo, hashString } from "./sequence";

export interface ScriptLibraryItemState {
    script: string;
}

const DEFAULT_SCRIPT_CONTENT = `export default defineSequence({
  uses: {},
  *run(s) {
    // Your sequence here — a bare \`yield\` advances one tick.
    yield* wait(beats(1));
  },
});`;

export type CompiledScript = { kind: "script"; instance: LMSScript } | { kind: "sequence"; definition: SequenceDefinition };

export class ScriptLibraryItem extends LibraryItem<ScriptLibraryItemState> {
    public type = LibraryItemType.SCRIPT;
    public name = "Script";

    public script = DEFAULT_SCRIPT_CONTENT;

    /** Fixtures declared in `uses`, as manifest key -> fixture id. Empty for classic `LMSScript` classes. */
    public declaredFixtures = new Map<string, string>();
    /** `uses` keys whose fixture could not be resolved when the script was compiled. */
    public missingDeclarations: string[] = [];

    private compiled?: CompiledScript;
    /** One per timeline item, so the same script placed twice keeps two independent playheads. */
    private readonly sequences = new Map<string, SequenceInstance>();

    public override save() {
        return {
            script: this.script,
        };
    }

    public override load(state: ScriptLibraryItemState) {
        this.script = state.script;
    }

    public get compiledScript(): CompiledScript | undefined {
        return this.compiled;
    }

    public setCompiledScript(compiled: CompiledScript | undefined, declared?: { declared: Map<string, string>; missing: string[] }) {
        this.compiled = compiled;
        this.declaredFixtures = declared?.declared ?? new Map();
        this.missingDeclarations = declared?.missing ?? [];
        // any running sequence belongs to the previous version of the code
        this.sequences.clear();
    }

    public async activate(itemId: string) {
        try {
            if (this.compiled?.kind === "script") {
                await this.compiled.instance.activate?.();
            } else if (this.compiled?.kind === "sequence") {
                this.sequences.set(itemId, new SequenceInstance(this.compiled.definition, hashString(itemId), scriptRuntime.writeGate));
            }
            this.error = "";
        } catch (err) {
            console.error(err);
            this.error = String(err);
        }
    }

    public async run(itemId: string, localTick: number, data: LMSCalculationData, info: Omit<SequenceTickInfo, "data">) {
        try {
            if (this.compiled?.kind === "script") {
                await this.compiled.instance.tick?.(data);
            } else if (this.compiled?.kind === "sequence") {
                let sequence = this.sequences.get(itemId);
                if (!sequence) {
                    sequence = new SequenceInstance(this.compiled.definition, hashString(itemId), scriptRuntime.writeGate);
                    this.sequences.set(itemId, sequence);
                }
                sequence.advanceTo(localTick, { ...info, data });
            }
            this.error = "";
        } catch (err) {
            console.error(err);
            this.error = String(err);
        }
    }

    public async deactivate(itemId: string) {
        try {
            if (this.compiled?.kind === "script") {
                await this.compiled.instance.deactivate?.();
            } else {
                this.sequences.delete(itemId);
            }
            this.error = "";
        } catch (err) {
            console.error(err);
            this.error = String(err);
        }
    }
}
