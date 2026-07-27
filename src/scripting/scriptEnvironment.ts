import { ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import type ts from "typescript";
import type { VirtualTypeScriptEnvironment } from "@typescript/vfs";

import { useLibrary } from "@/library";
import { isScriptLibraryItem } from "@/utils";
import apiDeclarations from "./lib.lmsApi.d.ts?raw";
import { ScriptLibraryItem } from "./script.libraryItem";

/**
 * Ambient declarations describing the scripting API.
 *
 * This is a plain file in the virtual file system rather than a `lib` entry: TypeScript resolves `lib: ["lmsApi"]` to
 * `lib.lmsapi.d.ts`, so the previous setup — which registered the content as `/lmsApi.d.ts` — never actually loaded it.
 */
const API_DECLARATIONS_PATH = "/lms.api.d.ts";

/**
 * TypeScript's own lib files, bundled rather than fetched from the playground CDN.
 *
 * The CDN path swallows every fetch error (`Promise.all(...).catch(() => {})`), so with no network the editor silently came up
 * with no lib types at all. Bundling also means the libs are not re-downloaded for every editor that opens. Vite emits these as
 * separate lazily-loaded chunks, so only the libs the compiler options actually ask for are ever fetched.
 */
const TS_LIB_FILES = import.meta.glob("/node_modules/typescript/lib/lib.*.d.ts", {
    query: "?raw",
    import: "default",
}) as Record<string, () => Promise<string>>;

export function getScriptPath(scriptId: string): string {
    return `/scripts/${scriptId}.ts`;
}

/**
 * The TypeScript environment shared by every script in the project.
 *
 * There is deliberately one environment for the whole project rather than one per open editor: a single program is what makes
 * cross-script imports resolve, lets rename refactorings reach every script, and surfaces diagnostics for scripts whose editor
 * is not currently open.
 */
export const useScriptEnvironment = defineStore("scriptEnvironment", () => {
    const library = useLibrary();
    const token = Symbol("scriptEnvironment");

    const ready = ref(false);
    const env = shallowRef<VirtualTypeScriptEnvironment | undefined>(undefined);

    let tsInstance: typeof ts | undefined;
    let initialization: Promise<void> | undefined;

    /** Idempotent: concurrent callers share one initialization. */
    function initialize(): Promise<void> {
        initialization ??= doInitialize();
        return initialization;
    }

    async function doInitialize(): Promise<void> {
        const [tsModule, vfs] = await Promise.all([import("typescript"), import("@typescript/vfs")]);
        tsInstance = tsModule;

        const compilerOptions: ts.CompilerOptions = {
            target: tsModule.ScriptTarget.ES2022,
            lib: ["es2022", "dom"],
            // the emitted code is run through `new Function(...)` with `exports`/`module`/`require` in scope
            module: tsModule.ModuleKind.CommonJS,
            moduleResolution: tsModule.ModuleResolutionKind.Node10,
            strict: true,
            noEmitOnError: false,
        };

        const fsMap = await loadLibFiles(vfs, compilerOptions);
        fsMap.set(API_DECLARATIONS_PATH, apiDeclarations);

        const system = vfs.createSystem(fsMap);
        env.value = vfs.createVirtualTypeScriptEnvironment(system, [API_DECLARATIONS_PATH], tsModule, compilerOptions);

        syncAllScripts();

        library.events.itemAdded.subscribe(token, (item) => {
            if (isScriptLibraryItem(item)) {
                syncScript(item);
            }
        });
        library.events.itemRemoved.subscribe(token, (item) => {
            if (isScriptLibraryItem(item)) {
                removeScript(item.id);
            }
        });
        library.events.loaded.subscribe(token, () => syncAllScripts());

        ready.value = true;
    }

    async function loadLibFiles(vfs: typeof import("@typescript/vfs"), compilerOptions: ts.CompilerOptions) {
        const fsMap = new Map<string, string>();
        const names = vfs.knownLibFilesForCompilerOptions(compilerOptions, tsInstance!);
        await Promise.all(
            names.map(async (name) => {
                const load = TS_LIB_FILES[`/node_modules/typescript/lib/${name}`];
                if (!load) {
                    // the lib list is a superset; not every name is shipped by every TypeScript version
                    return;
                }
                fsMap.set(`/${name}`, await load());
            })
        );
        return fsMap;
    }

    /** Mirror a script's source into the virtual file system. */
    function syncScript(item: ScriptLibraryItem): void {
        if (!env.value) {
            return;
        }
        const path = getScriptPath(item.id);
        // an empty file makes the language service unhappy, hence the space
        const content = item.script || " ";
        if (env.value.getSourceFile(path)) {
            env.value.updateFile(path, content);
        } else {
            env.value.createFile(path, content);
        }
    }

    function removeScript(scriptId: string): void {
        const path = getScriptPath(scriptId);
        if (env.value?.getSourceFile(path)) {
            env.value.deleteFile(path);
        }
    }

    function syncAllScripts(): void {
        for (const item of library.items) {
            if (isScriptLibraryItem(item)) {
                syncScript(item);
            }
        }
    }

    /** Type and syntax errors for one script, formatted for display. */
    function getScriptErrors(scriptId: string): string[] {
        if (!env.value || !tsInstance) {
            return [];
        }
        const path = getScriptPath(scriptId);
        const service = env.value.languageService;
        return [...service.getSyntacticDiagnostics(path), ...service.getSemanticDiagnostics(path)]
            .filter((d) => d.category === tsInstance!.DiagnosticCategory.Error)
            .map((d) => {
                const message = tsInstance!.flattenDiagnosticMessageText(d.messageText, "\n");
                if (d.file && d.start !== undefined) {
                    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
                    return `(${line + 1},${character + 1}): ${message}`;
                }
                return message;
            });
    }

    /**
     * Type-check a script, emit it and instantiate its default export.
     *
     * Unlike the previous implementation this refuses to run a script that does not type-check — running code the type system
     * has already rejected defeats the point of the whole feature.
     */
    async function compile(item: ScriptLibraryItem): Promise<unknown> {
        await initialize();
        syncScript(item);

        const errors = getScriptErrors(item.id);
        if (errors.length > 0) {
            throw new Error(errors.join("\n"));
        }

        const path = getScriptPath(item.id);
        const output = env.value!.languageService.getEmitOutput(path);
        const emitted = output.outputFiles.find((f) => f.name.endsWith(".js"));
        if (!emitted?.text) {
            throw new Error("No code generated");
        }

        return instantiate(emitted.text);
    }

    function instantiate(code: string): unknown {
        const module = { exports: {} as Record<string, unknown> };
        const require = () => {
            throw new Error("Importing modules is not supported yet");
        };

        // `new Function` rather than `eval` so the script cannot reach into this scope
        new Function("exports", "module", "require", code)(module.exports, module, require);

        const defaultExport = module.exports.default;
        if (!defaultExport) {
            throw new Error("Expected a default export");
        } else if (typeof defaultExport !== "function") {
            throw new Error("Expected the default export to be a class");
        }
        return new (defaultExport as new () => unknown)();
    }

    return { ready, env, initialize, getScriptPath, syncScript, removeScript, getScriptErrors, compile };
});
