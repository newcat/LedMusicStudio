<template>
    <div v-if="loading">Loading...</div>
    <Codemirror
        v-else
        :model-value="modelValue"
        :style="{ width: '100%', height: '100%' }"
        :indent-with-tab="true"
        :tab-size="2"
        :extensions="extensions"
        @keydown.stop=""
        @update:model-value="emit('update:modelValue', $event)"
    />
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Codemirror } from "vue-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { autocompletion } from "@codemirror/autocomplete";

import { useScriptEnvironment } from "./scriptEnvironment";
import { oneDark } from "./theme";

const props = defineProps<{
    modelValue: string;
    /** Path of this file in the shared TypeScript environment — this is what scopes the language service to it. */
    path: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const scriptEnvironment = useScriptEnvironment();
const loading = ref(true);

let extensions: any[] = [];

onMounted(async () => {
    await scriptEnvironment.initialize();
    const { tsSync, tsFacet, tsHover, tsLinter, tsAutocomplete } = await import("@valtown/codemirror-ts");

    extensions = [
        javascript({ typescript: true, jsx: true }),
        // the environment is shared across the whole project; `path` is what scopes it to this file
        tsFacet.of({ env: scriptEnvironment.env!, path: props.path }),
        tsSync(),
        tsLinter(),
        autocompletion({ override: [tsAutocomplete()] }),
        tsHover(),
        oneDark,
    ];

    loading.value = false;
});
</script>
