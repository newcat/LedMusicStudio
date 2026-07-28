import { LibraryItem, LibraryItemType } from "@/library";

export interface ScriptModuleLibraryItemState {
    script: string;
}

const DEFAULT_MODULE_CONTENT = `// Reusable flows, importable from your scripts as \`@lib/<this item's name>\`.
// The scripting API (wait, beats, hsv, ...) is available here too — no imports needed.

export function* blink(fixture: LMSLedStrip, color: LMSColor, period = beats(0.5)): LMSFlow {
  fixture.fill(color);
  yield* wait(period);
  yield* wait(period);
}
`;

/**
 * A module of reusable script code.
 *
 * Lives in the shared TypeScript environment as `/lib/<name>.ts`, so scripts can `import` from it with full type checking, and
 * is instantiated with the same injected API a script gets.
 */
export class ScriptModuleLibraryItem extends LibraryItem<ScriptModuleLibraryItemState> {
    public type = LibraryItemType.SCRIPT_LIBRARY;
    public name = "Patterns";

    public script = DEFAULT_MODULE_CONTENT;

    public override save() {
        return { script: this.script };
    }

    public override load(state: ScriptModuleLibraryItemState) {
        this.script = state.script;
    }
}
