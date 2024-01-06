<template>
    <Codemirror
        v-model="code"
        :style="{ height: '400px' }"
        :indent-with-tab="true"
        :tab-size="2"
        :extensions="extensions"
        @keydown.stop=""
    />
</template>

<script setup lang="ts">
import { Codemirror } from "vue-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

const code = defineModel<string>({ required: true });
const extensions = [javascript(), oneDark];
</script>
