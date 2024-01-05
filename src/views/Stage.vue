<template>
    <Card class="h-full" :pt="{ body: { class: 'p-0 h-full' }, content: { class: 'p-0 h-full' } }">
        <template #content>
            <div class="flex flex-col h-full">
                <div class="flex">
                    <TabMenu v-model:active-index="selectedTab" :model="menuItems" />
                    <Button text label="Import Stage" icon="mdi mdi-upload" @click="importStage" />
                    <Button text label="Export Stage" icon="mdi mdi-content-save" @click="exportStage" />
                </div>

                <div class="content">
                    <Fixtures v-if="selectedTab === 0" />
                    <Controllers v-else-if="selectedTab === 1" />
                    <Visualization v-else-if="selectedTab === 2" />
                </div>
            </div>
        </template>
    </Card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import TabMenu, { TabMenuProps } from "primevue/tabmenu";
import Card from "primevue/card";
import Button from "primevue/button";
import { useToast } from "primevue/usetoast";

import { showOpenDialog, readFile, showSaveDialog, writeFile } from "@/native";
import { useStage } from "@/stage";
import { useErrorHandler } from "@/utils";

import Fixtures from "@/stage/components/Fixtures.vue";
import Controllers from "@/stage/components/Controllers.vue";
import Visualization from "@/stage/components/Visualization.vue";

const toast = useToast();
const errorHandler = useErrorHandler();
const stage = useStage();

const selectedTab = ref(0);

const menuItems: TabMenuProps["model"] = [
    { label: "Fixtures", icon: "mdi mdi-lamp" },
    { label: "Controllers", icon: "mdi mdi-chip" },
    { label: "Visualization", icon: "mdi mdi-eye" },
];

async function importStage() {
    const dialogResult = await showOpenDialog({
        title: "Import Stage",
        filters: [{ name: "LedMusic Stage", extensions: ["lms"] }],
    });
    if (dialogResult.canceled) {
        return;
    }
    await errorHandler("Failed to import stage", async () => {
        const raw = await readFile(dialogResult.filePaths![0], { encoding: "utf-8" });
        stage.load(JSON.parse(raw));
        toast.add({ severity: "success", summary: "Success", detail: "Stage successfully imported", life: 2000 });
    });
}

async function exportStage() {
    const dialogResult = await showSaveDialog({
        title: "Export Stage",
        filters: [{ name: "LedMusic Stage", extensions: ["lms"] }],
    });
    if (dialogResult.canceled) {
        return;
    }
    const path = dialogResult.filePath!;
    await errorHandler("Failed to export stage", async () => {
        const state = stage.save();
        await writeFile(path, JSON.stringify(state));
        toast.add({ severity: "success", summary: "Success", detail: "Stage successfully exported", life: 2000 });
    });
}
</script>

<style scoped>
.content {
    margin: 1rem;
    display: flex;
    height: 100%;
    width: calc(100% - 2rem);
}
</style>
