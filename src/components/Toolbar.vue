<template>
    <n-menu v-model:value="selected" mode="horizontal" :options="menuItems"></n-menu>
</template>

<script setup lang="ts">
import { NMenu, MenuOption } from "naive-ui";
import { ref, watch } from "vue";

const events = ["newProject", "load", "save", "saveAs", "showSettings"];

const emit = defineEmits(events);

const selected = ref<string | null>(null);

watch(selected, () => {
    if (!selected) {
        return;
    }
    if (events.includes(selected.value!)) {
        emit(selected.value!);
    }
    selected.value = null;
});

const menuItems: MenuOption[] = [
    {
        key: "file",
        label: "File",
        children: [
            { key: "newProject", label: "New" },
            { key: "load", label: "Open" },
            { key: "save", label: "Save" },
            { key: "saveAs", label: "Save as" },
        ],
    },
    { key: "Edit", label: "Edit", children: [{ key: "showSettings", label: "Settings" }] },
];
</script>
