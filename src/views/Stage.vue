<template>
    <Card class="h-full" :pt="{ body: { class: 'p-0 h-full' }, content: { class: 'p-0 h-full' } }">
        <template #content>
            <div class="flex flex-col h-full">
                <div class="flex">
                    <TabMenu v-model:active-index="activeStageTab" :model="menuItems" />
                    <Button text label="Import Stage" icon="mdi mdi-upload" @click="importStage" />
                    <Button text label="Export Stage" icon="mdi mdi-content-save" @click="exportStage" />
                </div>

                <div class="content">
                    <Fixtures v-if="activeStageTab === 0" />
                    <Controllers v-else-if="activeStageTab === 1" />
                    <Visualization v-else-if="activeStageTab === 2" />
                    <Groups v-else-if="activeStageTab === 3" />
                </div>
            </div>
        </template>
    </Card>
</template>

<script setup lang="ts">
import TabMenu, { TabMenuProps } from "primevue/tabmenu";
import Card from "primevue/card";
import Button from "primevue/button";
import { useToast } from "primevue/usetoast";

import { getNativeAdapter } from "@/native";
import { useStage } from "@/stage";
import { useErrorHandler } from "@/utils";
import { activeStageTab } from "./stageViewState";

import Fixtures from "@/stage/components/Fixtures.vue";
import Controllers from "@/stage/components/Controllers.vue";
import Visualization from "@/stage/components/Visualization.vue";
import Groups from "@/stage/components/Groups.vue";

const toast = useToast();
const errorHandler = useErrorHandler();
const stage = useStage();
const nativeAdapter = getNativeAdapter();

const menuItems: TabMenuProps["model"] = [
    { label: "Fixtures", icon: "mdi mdi-lamp" },
    { label: "Controllers", icon: "mdi mdi-chip" },
    { label: "Visualization", icon: "mdi mdi-eye" },
    { label: "Groups", icon: "mdi mdi-lamps" },
];

async function importStage() {
    const result = await nativeAdapter.chooseAndReadFile({
        accept: [{ name: "LedMusic Stage", extensions: ["lms"] }],
    });
    if (!result) {
        return;
    }
    await errorHandler("Failed to import stage", () => {
        // the imported stage replaces the current one instead of being mixed into it
        stage.reset();
        stage.load(JSON.parse(result.dataAsString));
        toast.add({ severity: "success", summary: "Success", detail: "Stage successfully imported", life: 2000 });
    });
}

async function exportStage() {
    await errorHandler("Failed to export stage", async () => {
        const state = new TextEncoder().encode(JSON.stringify(stage.save()));
        const success = await nativeAdapter.chooseAndWriteFile(state, {
            accept: [{ name: "LedMusic Stage", extensions: ["lms"] }],
            suggestedName: "stage.lms",
        });
        if (success) {
            toast.add({ severity: "success", summary: "Success", detail: "Stage successfully exported", life: 2000 });
        }
    });
}
</script>

<style scoped>
.content {
    margin: 1rem;
    display: flex;
    min-height: 0;
    height: 100%;
    width: calc(100% - 2rem);
}
</style>
