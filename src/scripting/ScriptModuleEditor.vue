<template>
    <div class="module-hint">
        Import from a script as <code>{{ importSpecifier }}</code>
    </div>
    <CodeEditor v-model="props.module.script" :path="scriptEnvironment.getModulePath(props.module)" />
</template>

<script setup lang="ts">
import { computed } from "vue";

import CodeEditor from "./CodeEditor.vue";
import { ScriptModuleLibraryItem } from "./scriptModule.libraryItem";
import { useScriptEnvironment } from "./scriptEnvironment";

const props = defineProps<{
    module: ScriptModuleLibraryItem;
}>();

const scriptEnvironment = useScriptEnvironment();

const importSpecifier = computed(() => `@lib/${props.module.name}`);
</script>

<style scoped>
.module-hint {
    padding: 0.25rem 0.75rem;
    font-size: 0.8rem;
    opacity: 0.75;
}
</style>
