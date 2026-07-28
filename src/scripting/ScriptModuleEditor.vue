<template>
    <div class="module-editor">
        <div class="module-editor__toolbar">
            <span class="module-editor__hint">
                Import from a script as <code>{{ importSpecifier }}</code>
            </span>
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
        <CodeEditor v-model="props.module.script" :path="scriptEnvironment.getModulePath(props.module)" />
        <ScriptingHelp v-model:visible="helpVisible" />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "primevue/button";

import CodeEditor from "./CodeEditor.vue";
import ScriptingHelp from "./help/ScriptingHelp.vue";
import { ScriptModuleLibraryItem } from "./scriptModule.libraryItem";
import { useScriptEnvironment } from "./scriptEnvironment";

const props = defineProps<{
    module: ScriptModuleLibraryItem;
}>();

const scriptEnvironment = useScriptEnvironment();

const helpVisible = ref(false);
const importSpecifier = computed(() => `@lib/${props.module.name}`);
</script>

<style scoped>
.module-editor {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
}

.module-editor__toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid var(--p-content-border-color);
}

.module-editor__hint {
    flex: 1;
    font-size: 0.8rem;
    opacity: 0.75;
}
</style>
