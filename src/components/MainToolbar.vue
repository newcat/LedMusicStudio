<template>
    <Menubar :model="menuItems">
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

const currentView = defineModel<"PROGRAMMING" | "STAGE" | "VISUALIZATION">("view", { required: true });
const emit = defineEmits(["newProject", "load", "save", "saveAs", "showSettings"]);

const globalState = useGlobalState();
const bridge = useBridge();

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
    }
});

const menuItems = computed<MenubarProps["model"]>(() => [
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
    {
        label: "Stage",
        icon: "mdi mdi-cast-variant",
        class: currentView.value === "STAGE" ? "p-highlight p-menuitem-active" : "",
        command: () => {
            currentView.value = "STAGE";
        },
    },
    {
        label: "Programming",
        icon: "mdi mdi-code-braces",
        class: currentView.value === "PROGRAMMING" ? "p-highlight p-menuitem-active" : "",
        command: () => {
            currentView.value = "PROGRAMMING";
        },
    },
    {
        label: "Visualization",
        icon: "mdi mdi-eye",
        class: currentView.value === "VISUALIZATION" ? "p-highlight p-menuitem-active" : "",
        command: () => {
            currentView.value = "VISUALIZATION";
        },
    },
]);
</script>

<style scoped>
.status-button {
    opacity: 1;
}
</style>
