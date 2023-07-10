<template>
    <Menubar :model="menuItems">
        <template #end>
            <div v-tooltip="{ value: tooltipText }">
                <Button
                    class="status-button"
                    icon="mdi mdi-bridge"
                    text
                    :severity="connectionStateToSeverity"
                    :disabled="!globalState.bridgeUrl || outputStore.bridgeConnectionStatus !== 'DISCONNECTED'"
                    @click="outputStore.connect"
                ></Button>
            </div>
        </template>
    </Menubar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Menubar, { MenubarProps } from "primevue/menubar";
import Button from "primevue/button";
import { useOutputStore } from "@/output/outputStore";
import { useGlobalState } from "@/globalState";

const emit = defineEmits(["newProject", "load", "save", "saveAs", "showSettings"]);

const globalState = useGlobalState();
const outputStore = useOutputStore();

const connectionStateToSeverity = computed(() => {
    if (!globalState.bridgeUrl) {
        return "secondary";
    }

    switch (outputStore.bridgeConnectionStatus) {
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

    switch (outputStore.bridgeConnectionStatus) {
        case "CONNECTED":
            return "Connected to bridge";
        case "CONNECTING":
            return "Connecting to bridge...";
        case "DISCONNECTED":
            return "Connect to bridge";
    }
});

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

<style scoped>
.status-button {
    opacity: 1;
}
</style>
