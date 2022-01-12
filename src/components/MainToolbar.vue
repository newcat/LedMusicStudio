<template>
    <toolbar>
        <n-menu v-model:value="selected" mode="horizontal" :options="menuItems"></n-menu>
    </toolbar>
</template>

<script setup lang="ts">
import { NMenu, MenuOption } from "naive-ui";
import { ref, watch } from "vue";
import Toolbar from "./Toolbar.vue";

const events = ["newProject", "load", "save", "saveAs", "showSettings"] as const;
type EventsTuple = typeof events;
type Event = EventsTuple[number];

const emit = defineEmits(["newProject", "load", "save", "saveAs", "showSettings"]);

const selected = ref<string | null>(null);

function isEvent(s: any): s is Event {
    return events.includes(s);
}

watch(selected, () => {
    if (!selected) {
        return;
    }
    if (isEvent(selected.value)) {
        emit(selected.value);
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
