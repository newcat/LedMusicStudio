<template>
    <div class="script-editor">
        <div class="script-editor__toolbar">
            <Button label="Compile" size="small" :loading="props.script.loading" @click="compile" />
            <Button
                v-tooltip.bottom="'Scripting guide'"
                icon="pi pi-question-circle"
                size="small"
                text
                rounded
                aria-label="Scripting guide"
                @click="helpVisible = true"
            />
        </div>
        <CodeEditor v-model="props.script.script" :path="scriptEnvironment.getScriptPath(props.script.id)" />
        <ScriptingHelp v-model:visible="helpVisible" />
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import { useToast } from "primevue/usetoast";

import CodeEditor from "./CodeEditor.vue";
import ScriptingHelp from "./help/ScriptingHelp.vue";
import { ScriptLibraryItem } from "./script.libraryItem";
import { useScriptEnvironment } from "./scriptEnvironment";

const props = defineProps<{
    script: ScriptLibraryItem;
}>();

const toast = useToast();
const scriptEnvironment = useScriptEnvironment();

const helpVisible = ref(false);

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

<style scoped>
.script-editor {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
}

.script-editor__toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid var(--p-content-border-color);
}
</style>
