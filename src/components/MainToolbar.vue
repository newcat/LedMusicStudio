<template>
    <Menubar :model="menuItems"></Menubar>
</template>

<script setup lang="ts">
import Menubar, { MenubarProps } from "primevue/menubar";

const emit = defineEmits(["newProject", "load", "save", "saveAs", "showSettings"]);

const menuItems: MenubarProps["model"] = [
    {
        label: "File",
        items: [
            { label: "New", command: () => emit("newProject") },
            { label: "Open", command: () => emit("load") },
            { label: "Save", command: () => emit("save") },
            { label: "Save as", command: () => emit("saveAs") },
        ],
    },
    {
        label: "Edit",
        items: [{ label: "Settings", command: () => emit("showSettings") }],
    },
];
</script>
