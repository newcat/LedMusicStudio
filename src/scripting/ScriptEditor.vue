<template>
    <CodeEditor v-model="props.script.script" :path="scriptEnvironment.getScriptPath(props.script.id)" />
    <button @click="compile">Compile</button>
</template>

<script setup lang="ts">
import { useToast } from "primevue/usetoast";

import CodeEditor from "./CodeEditor.vue";
import { ScriptLibraryItem } from "./script.libraryItem";
import { useScriptEnvironment } from "./scriptEnvironment";

const props = defineProps<{
    script: ScriptLibraryItem;
}>();

const toast = useToast();
const scriptEnvironment = useScriptEnvironment();

async function compile() {
    try {
        props.script.loading = true;
        await scriptEnvironment.compile(props.script);
        props.script.error = "";

        // the manifest is only known once the script has been compiled, so this is the first chance to check it
        const notes = scriptEnvironment.validate().filter((p) => p.scriptId === props.script.id && p.severity === "note");
        toast.add({
            severity: "success",
            summary: "Script compiled",
            detail: notes.map((n) => n.message).join("\n") || undefined,
            life: notes.length > 0 ? 6000 : 2000,
        });
    } catch (e) {
        console.error(e);
        props.script.error = String(e);
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
