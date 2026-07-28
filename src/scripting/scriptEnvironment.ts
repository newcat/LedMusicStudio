import { computed, ref, shallowRef, watch } from "vue";
import { defineStore } from "pinia";
import type ts from "typescript";
import type { VirtualTypeScriptEnvironment } from "@typescript/vfs";

import { useLibrary } from "@/library";
import { useStage } from "@/stage";
import { useTimeline } from "@/timeline";
import { isScriptLibraryItem, isScriptModuleLibraryItem } from "@/utils";
import { scriptRuntime } from "./api/runtime";
import { createScriptGlobals } from "./api/scriptGlobals";
import { generateStageDeclarations } from "./generateStageDeclarations";
import builtinPatterns from "./builtin/patterns.ts?raw";
import apiDeclarations from "./lib.lmsApi.d.ts?raw";
import { CompiledScript, ScriptLibraryItem } from "./script.libraryItem";
import { createLoopGuardTransformer } from "./loopGuard";
import { applyReplacements, planRename, RenamePlan } from "./rename";
import { ScriptModuleLibraryItem } from "./scriptModule.libraryItem";
import { isSequenceDefinition } from "./sequence";
import { ScriptProblem, validateScripts } from "./validation";

/**
 * Ambient declarations describing the scripting API.
 *
 * This is a plain file in the virtual file system rather than a `lib` entry: TypeScript resolves `lib: ["lmsApi"]` to
 * `lib.lmsapi.d.ts`, so the previous setup — which registered the content as `/lmsApi.d.ts` — never actually loaded it.
 */
const API_DECLARATIONS_PATH = "/lms.api.d.ts";

/** Declarations for the fixtures and tracks of the current project, regenerated whenever it changes. */
const STAGE_DECLARATIONS_PATH = "/lms.stage.d.ts";

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

/** Modules that ship with the app, importable as `@lms/<name>`. */
const BUILTIN_MODULES: Record<string, string> = {
    "/builtin/patterns.ts": builtinPatterns,
};

/**
 * Map an import specifier onto a file in the virtual file system.
 *
 * Mirrors the `paths` compiler option below, so what the editor resolves and what `require` resolves cannot drift.
 */
export function resolveModulePath(specifier: string): string | undefined {
    if (specifier.startsWith("@lms/")) {
        return `/builtin/${specifier.slice("@lms/".length)}.ts`;
    } else if (specifier.startsWith("@lib/")) {
        return `/lib/${specifier.slice("@lib/".length)}.ts`;
    }
    return undefined;
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
    const stage = useStage();
    const timeline = useTimeline();
    const token = Symbol("scriptEnvironment");

    const ready = ref(false);
    const env = shallowRef<VirtualTypeScriptEnvironment | undefined>(undefined);

    // a computed rather than manual invalidation: it re-runs on exactly the fixture, track and item state the generator reads
    const stageDeclarations = computed(() =>
        generateStageDeclarations(Array.from(stage.fixtures.values()), timeline.tracks, timeline.items)
    );

    let tsInstance: typeof ts | undefined;
    let initialization: Promise<void> | undefined;

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
    library.events.loaded.subscribe(token, () => {
        syncAllScripts();
        syncModules();
        void compileAll();
    });

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
            baseUrl: "/",
            paths: {
                "@lms/*": ["builtin/*"],
                "@lib/*": ["lib/*"],
            },
        };

        const fsMap = await loadLibFiles(vfs, compilerOptions);
        fsMap.set(API_DECLARATIONS_PATH, apiDeclarations);
        fsMap.set(STAGE_DECLARATIONS_PATH, stageDeclarations.value);
        for (const [path, content] of Object.entries(BUILTIN_MODULES)) {
            fsMap.set(path, content);
        }

        const system = vfs.createSystem(fsMap);
        const rootFiles = [API_DECLARATIONS_PATH, STAGE_DECLARATIONS_PATH];
        env.value = vfs.createVirtualTypeScriptEnvironment(system, rootFiles, tsModule, compilerOptions, {
            before: [createLoopGuardTransformer(tsModule)],
        });

        watch(stageDeclarations, (declarations) => env.value?.updateFile(STAGE_DECLARATIONS_PATH, declarations));

        syncAllScripts();
        syncModules();
        // module paths are derived from the item name, so a rename moves the file
        watch(moduleFiles, syncModules, { deep: true });

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

    function getModulePath(item: ScriptModuleLibraryItem): string {
        return `/lib/${item.name}.ts`;
    }

    const moduleFiles = computed(() =>
        library.items.filter(isScriptModuleLibraryItem).map((item) => ({ id: item.id, path: getModulePath(item), content: item.script }))
    );

    /** Tracks where each module item currently lives, so a rename moves its file rather than leaving a stale copy behind. */
    const modulePaths = new Map<string, string>();

    function syncModules(): void {
        if (!env.value) {
            return;
        }

        const wanted = moduleFiles.value;
        const wantedIds = new Set(wanted.map((m) => m.id));

        for (const [id, path] of modulePaths) {
            const current = wanted.find((m) => m.id === id);
            if ((!wantedIds.has(id) || current!.path !== path) && env.value.getSourceFile(path)) {
                env.value.deleteFile(path);
                modulePaths.delete(id);
            }
        }

        for (const module of wanted) {
            const content = module.content || " ";
            if (env.value.getSourceFile(module.path)) {
                env.value.updateFile(module.path, content);
            } else {
                env.value.createFile(module.path, content);
            }
            modulePaths.set(module.id, module.path);
        }
    }

    /** Type and syntax errors for one script, formatted for display. */
    function getScriptErrors(scriptId: string): string[] {
        return getFileErrors(getScriptPath(scriptId));
    }

    function getFileErrors(path: string): string[] {
        if (!env.value || !tsInstance) {
            return [];
        }
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
    async function compile(item: ScriptLibraryItem): Promise<CompiledScript> {
        await initialize();
        syncScript(item);

        const errors = getScriptErrors(item.id);
        if (errors.length > 0) {
            throw new Error(errors.join("\n"));
        }

        const compiled = instantiate(getScriptPath(item.id));
        const declared =
            compiled.kind === "sequence" ? scriptRuntime.resolveDeclaredFixtures(compiled.definition.uses) : undefined;
        item.setCompiledScript(compiled, declared);
        return compiled;
    }

    /**
     * Compile every script in the project.
     *
     * Runs after a project loads: only the source is saved, so without this a freshly opened project has scripts that look
     * present but do nothing until each one is opened and compiled by hand.
     */
    async function compileAll(): Promise<void> {
        const scripts = library.items.filter(isScriptLibraryItem);
        if (scripts.length === 0) {
            return;
        }

        await initialize();
        for (const script of scripts) {
            try {
                await compile(script);
                script.error = "";
            } catch (err) {
                console.error(err);
                script.error = String(err instanceof Error ? err.message : err);
            }
        }
        validate();
    }

    /**
     * Rewrite every script reference to a fixture or track that is about to be renamed.
     *
     * Must be called before the name actually changes: the plan is worked out against the declarations as they stand, and once
     * the name changes those references no longer resolve to anything.
     */
    function renameDeclaredName(oldName: string, newName: string): RenamePlan {
        if (!env.value || !tsInstance || oldName === newName) {
            return { edits: [], count: 0 };
        }

        const plan = planRename(
            tsInstance,
            env.value.languageService,
            STAGE_DECLARATIONS_PATH,
            stageDeclarations.value,
            oldName,
            newName,
            (fileName) => fileName.startsWith("/scripts/") || fileName.startsWith("/lib/")
        );
        if (plan.blockedReason || plan.edits.length === 0) {
            return plan;
        }

        for (const edit of plan.edits) {
            if (edit.fileName.startsWith("/scripts/")) {
                const id = edit.fileName.slice("/scripts/".length, -".ts".length);
                const script = library.items.filter(isScriptLibraryItem).find((s) => s.id === id);
                if (script) {
                    script.script = applyReplacements(script.script, edit.replacements);
                    syncScript(script);
                }
            } else {
                const name = edit.fileName.slice("/lib/".length, -".ts".length);
                const module = library.items.filter(isScriptModuleLibraryItem).find((m) => m.name === name);
                if (module) {
                    module.script = applyReplacements(module.script, edit.replacements);
                }
            }
        }

        return plan;
    }

    /**
     * Check every compiled script against the project as it is now.
     *
     * Errors are written to the library item so they show up next to the script; overlap notes are returned for the caller to
     * do something with.
     */
    function validate(): ScriptProblem[] {
        const scripts = library.items.filter(isScriptLibraryItem);
        const problems = validateScripts(scripts, stage.fixtures, timeline.items);

        for (const script of scripts) {
            const errors = problems.filter((p) => p.scriptId === script.id && p.severity === "error");
            if (errors.length > 0) {
                script.error = errors.map((e) => e.message).join("\n");
            } else if (script.missingDeclarations.length === 0) {
                script.error = "";
            }
        }

        return problems;
    }

    function instantiate(path: string): CompiledScript {
        // a fresh cache per compile, so edits to an imported module are picked up rather than served from a stale copy
        const exports = loadModule(path, new Map());

        const defaultExport = exports.default;
        if (!defaultExport) {
            throw new Error("Expected a default export");
        } else if (isSequenceDefinition(defaultExport)) {
            return { kind: "sequence", definition: defaultExport };
        } else if (typeof defaultExport === "function") {
            return { kind: "script", instance: new (defaultExport as new () => LMSScript)() };
        }
        throw new Error("Expected the default export to be a defineSequence(...) result or a class");
    }

    /**
     * Compile and run one file from the virtual file system, resolving its imports to other files in the same environment.
     *
     * Every module gets the same injected API a script does, so a shared pattern library can use `wait`, `beats` and the rest
     * without importing anything.
     */
    function loadModule(path: string, loaded: Map<string, Record<string, unknown>>): Record<string, unknown> {
        const cached = loaded.get(path);
        if (cached) {
            return cached;
        }

        const errors = getFileErrors(path);
        if (errors.length > 0) {
            throw new Error(`In ${path}:\n${errors.join("\n")}`);
        }

        const output = env.value!.languageService.getEmitOutput(path);
        const emitted = output.outputFiles.find((f) => f.name.endsWith(".js"));
        if (!emitted?.text) {
            throw new Error(`No code generated for ${path}`);
        }

        const module = { exports: {} as Record<string, unknown> };
        // registered before executing so a cycle sees a partially populated object rather than recursing forever
        loaded.set(path, module.exports);

        const require = (specifier: string): Record<string, unknown> => {
            const resolved = resolveModulePath(specifier);
            if (!resolved) {
                throw new Error(`Cannot resolve "${specifier}". Use "@lib/<name>" for a script library, or "@lms/patterns".`);
            }
            if (!env.value!.getSourceFile(resolved)) {
                throw new Error(`Module "${specifier}" does not exist.`);
            }
            return loadModule(resolved, loaded);
        };

        const globals = createScriptGlobals();
        // `new Function` rather than `eval` so the module cannot reach into this scope
        const parameterNames = ["exports", "module", "require", ...Object.keys(globals)];
        new Function(...parameterNames, emitted.text)(module.exports, module, require, ...Object.values(globals));

        loaded.set(path, module.exports);
        return module.exports;
    }

    return {
        ready,
        env,
        stageDeclarations,
        initialize,
        getScriptPath,
        getModulePath,
        syncScript,
        removeScript,
        getScriptErrors,
        getFileErrors,
        compile,
        compileAll,
        renameDeclaredName,
        validate,
    };
});
