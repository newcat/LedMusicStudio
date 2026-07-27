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
import { Codemirror } from "vue-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { autocompletion } from "@codemirror/autocomplete";

import { ScriptLibraryItem } from "./script.libraryItem";
import { useScriptEnvironment } from "./scriptEnvironment";
import { oneDark } from "./theme";

const props = defineProps<{
    script: ScriptLibraryItem;
}>();

const toast = useToast();
const scriptEnvironment = useScriptEnvironment();

const loading = ref(true);

let extensions: any[] = [];

onMounted(async () => {
    await scriptEnvironment.initialize();
    const { tsSync, tsFacet, tsHover, tsLinter, tsAutocomplete } = await import("@valtown/codemirror-ts");

    extensions = [
        javascript({
            typescript: true,
            jsx: true,
        }),
        // the environment is shared across the whole project; `path` is what scopes it to this script
        tsFacet.of({ env: scriptEnvironment.env!, path: scriptEnvironment.getScriptPath(props.script.id) }),
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
    try {
        props.script.loading = true;
        const instance = await scriptEnvironment.compile(props.script);
        props.script.setCompiledScript(instance);
        props.script.error = "";
        toast.add({ severity: "success", summary: "Script compiled", life: 2000 });
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
