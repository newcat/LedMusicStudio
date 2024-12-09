<template>
    <div v-if="loading">Loading...</div>
    <Codemirror
        v-else
        v-model="props.script.script"
        :style="{ width: '100%', height: '100%' }"
        :indent-with-tab="true"
        :tab-size="2"
        :extensions="extensions"
        @keydown.stop=""
    />
    <button @click="compile">Compile</button>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import { createDefaultMapFromCDN, createSystem, createVirtualTypeScriptEnvironment, createVirtualCompilerHost } from "@typescript/vfs";
import ts from "typescript";
import { Codemirror } from "vue-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { autocompletion } from "@codemirror/autocomplete";
import { tsSync, tsFacet, tsHover, tsLinter, tsAutocomplete } from "@valtown/codemirror-ts";

import apiDefinition from "./lib.lmsApi.d.ts?raw";
import { ScriptLibraryItem } from "./script.libraryItem";
import { oneDark } from "./theme";

const props = defineProps<{
    script: ScriptLibraryItem;
}>();

const toast = useToast();

const loading = ref(true);

let extensions: any[] = [];
let system: ts.System;

onMounted(async () => {
    const fsMap = await createDefaultMapFromCDN({ target: ts.ScriptTarget.ES2022, lib: ["dom"] }, "5.6.3", false, ts);
    fsMap.set("/lmsApi.d.ts", apiDefinition);
    system = createSystem(fsMap);
    const compilerOpts = {
        lib: ["dom", "es2022", "lmsApi"],
    };
    const env = createVirtualTypeScriptEnvironment(system, [], ts, compilerOpts);

    extensions = [
        javascript({
            typescript: true,
            jsx: true,
        }),
        tsFacet.of({ env, path: "/index.ts" }),
        tsSync(),
        tsLinter(),
        autocompletion({
            override: [tsAutocomplete()],
        }),
        tsHover(),
        oneDark,
    ];

    loading.value = false;
});

async function compile() {
    const host = createVirtualCompilerHost(
        system,
        {
            lib: ["dom", "es2022", "lmsApi"],
            module: ts.ModuleKind.UMD,
        },
        ts,
    );
    const program = ts.createProgram({
        host: host.compilerHost,
        rootNames: ["/index.ts"],
        options: {
            module: ts.ModuleKind.UMD,
        },
    });

    try {
        props.script.loading = true;

        let indexCode = "";
        program.emit(undefined, (fileName, data) => {
            if (fileName === "/index.js") {
                indexCode = data;
            }
        });
        if (!indexCode) {
            throw new Error("No code generated");
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        function require() {
            throw new Error("require is not supported");
        }
        const exports: any = {};
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const module = {
            exports,
        };
        eval(indexCode);
        if (!exports.default) {
            throw new Error("Expected default export");
        } else if (typeof exports.default !== "function") {
            throw new Error("Expected default export to be a class");
        }

        const instance = new exports.default();
        props.script.setCompiledScript(instance);
    } catch (e) {
        console.error(e);
        toast.add({
            severity: "error",
            summary: "Error compiling script",
            detail: String(e),
            life: 5000,
        });
    } finally {
        props.script.loading = false;
    }
}
</script>
