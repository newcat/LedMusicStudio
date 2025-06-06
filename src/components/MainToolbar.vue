<template>
    <Menubar class="main-toolbar" :model="menuItems">
        <template #end>
            <div v-tooltip="{ value: tooltipText }">
                <Button
                    class="status-button"
                    icon="mdi mdi-bridge"
                    text
                    :severity="connectionStateToSeverity"
                    :disabled="!globalState.bridgeUrl || bridge.connectionStatus !== 'DISCONNECTED'"
                    @click="bridge.connect"
                ></Button>
            </div>
        </template>
    </Menubar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Menubar, { MenubarProps } from "primevue/menubar";
import Button from "primevue/button";

import { useBridge } from "@/bridge";
import { useGlobalState } from "@/globalState";
import { getNativeAdapter } from "@/native";

const currentView = defineModel<"PROGRAMMING" | "STAGE" | "VISUALIZATION">("view", { required: true });
const emit = defineEmits(["newProject", "load", "save", "saveAs", "showSettings", "render"]);

const globalState = useGlobalState();
const bridge = useBridge();
const nativeAdapter = getNativeAdapter();

const connectionStateToSeverity = computed(() => {
    if (!globalState.bridgeUrl) {
        return "secondary";
    }

    switch (bridge.connectionStatus) {
        case "CONNECTED":
            return "success";
        case "CONNECTING":
            return "warning";
        case "DISCONNECTED":
            return "danger";
        default:
            throw new Error("Unknown connection status");
    }
});

const tooltipText = computed(() => {
    if (!globalState.bridgeUrl) {
        return "No bridge URL provided";
    }

    switch (bridge.connectionStatus) {
        case "CONNECTED":
            return "Connected to bridge";
        case "CONNECTING":
            return "Connecting to bridge...";
        case "DISCONNECTED":
            return "Connect to bridge";
        default:
            throw new Error("Unknown connection status");
    }
});

const menuItems = computed<MenubarProps["model"]>(() => [
    {
        label: "File",
        items: [
            { label: "New", command: () => emit("newProject") },
            { label: "Open", command: () => emit("load") },
            { label: "Save", command: () => emit("save") },
            // Save as only supported in electron
            ...(nativeAdapter.isElectron() ? [{ label: "Save as", command: () => emit("saveAs") }] : []),
        ],
    },
    {
        label: "Edit",
        items: [{ label: "Settings", command: () => emit("showSettings") }],
    },
    {
        label: "Project",
        items: [{ label: "Render", command: () => emit("render") }],
    },
    {
        label: "Stage",
        icon: "mdi mdi-cast-variant",
        class: currentView.value === "STAGE" ? "active" : "",
        command: () => {
            currentView.value = "STAGE";
        },
    },
    {
        label: "Programming",
        icon: "mdi mdi-code-braces",
        class: currentView.value === "PROGRAMMING" ? "active" : "",
        command: () => {
            currentView.value = "PROGRAMMING";
        },
    },
    {
        label: "Open Visualizer",
        icon: "mdi mdi-eye",
        command: () => {
            window.open("/visualization.html", "_blank");
        },
    },
]);
</script>

<style scoped>
.status-button {
    opacity: 1;
}

.main-toolbar :deep(.active .p-menubar-item-content) {
    outline: 1px solid var(--p-primary-color);
    color: var(--p-primary-color) !important;
}

.main-toolbar :deep(.active .p-menubar-item-icon) {
    color: var(--p-primary-color) !important;
}

.main-toolbar :deep(.p-menubar-submenu) {
    z-index: 10;
}
</style>
