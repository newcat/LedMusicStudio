import type ts from "typescript";

export interface RenameEdit {
    fileName: string;
    /** Replacements sorted last-to-first, so applying them in order keeps earlier offsets valid. */
    replacements: Array<{ start: number; length: number; text: string }>;
}

export interface RenamePlan {
    edits: RenameEdit[];
    /** Total number of references that would be rewritten. */
    count: number;
    /**
     * Set when the rename cannot be applied safely, in which case nothing is rewritten and the scripts are left to fail
     * type-checking against the new declarations instead.
     */
    blockedReason?: string;
}

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Work out how to rewrite every reference to a renamed fixture or track.
 *
 * The generated declarations key on the exact name, so a rename would otherwise break every script that used it. TypeScript
 * already knows where those references are — they are all resolved through one declaration in the generated file — so this asks
 * the language service the same question the editor's rename refactoring asks.
 *
 * Must be called *before* the name changes, while the old declarations are still what the program sees.
 */
export function planRename(
    tsInstance: typeof ts,
    languageService: ts.LanguageService,
    declarationsPath: string,
    declarationsText: string,
    oldName: string,
    newName: string,
    isEditableFile: (fileName: string) => boolean
): RenamePlan {
    const position = findDeclarationPosition(declarationsText, oldName);
    if (position < 0) {
        return { edits: [], count: 0, blockedReason: `"${oldName}" is not in the generated declarations.` };
    }

    const locations = languageService.findRenameLocations(declarationsPath, position, false, false) ?? [];
    const editable = locations.filter((l) => isEditableFile(l.fileName));
    if (editable.length === 0) {
        return { edits: [], count: 0 };
    }

    // `stage.Ceiling` only works while the name is a valid identifier; `stage["My Fixture"]` works for anything
    if (!IDENTIFIER_PATTERN.test(newName)) {
        const program = languageService.getProgram();
        const usesDotAccess = editable.some((location) => {
            const text = program?.getSourceFile(location.fileName)?.text ?? "";
            return text[location.textSpan.start - 1] !== '"' && text[location.textSpan.start - 1] !== "'";
        });
        if (usesDotAccess) {
            return {
                edits: [],
                count: editable.length,
                blockedReason:
                    `"${newName}" is not a valid identifier, and some scripts reach this fixture as \`stage.${oldName}\`. ` +
                    `Change those to \`stage[${JSON.stringify(newName)}]\` first, or pick a name without spaces or punctuation.`,
            };
        }
    }

    const byFile = new Map<string, RenameEdit>();
    for (const location of editable) {
        const edit = byFile.get(location.fileName) ?? { fileName: location.fileName, replacements: [] };
        edit.replacements.push({
            start: location.textSpan.start,
            length: location.textSpan.length,
            text: `${location.prefixText ?? ""}${newName}${location.suffixText ?? ""}`,
        });
        byFile.set(location.fileName, edit);
    }

    for (const edit of byFile.values()) {
        edit.replacements.sort((a, b) => b.start - a.start);
    }

    return { edits: [...byFile.values()], count: editable.length };
}

export function applyReplacements(source: string, replacements: RenameEdit["replacements"]): string {
    let result = source;
    for (const replacement of replacements) {
        result = result.slice(0, replacement.start) + replacement.text + result.slice(replacement.start + replacement.length);
    }
    return result;
}

/** Locate the declared name inside the generated declarations, which is where every reference resolves to. */
function findDeclarationPosition(declarationsText: string, name: string): number {
    const needle = `readonly ${JSON.stringify(name)}:`;
    const index = declarationsText.indexOf(needle);
    if (index < 0) {
        return -1;
    }
    // point at the first character inside the quotes
    return index + "readonly ".length + 1;
}
