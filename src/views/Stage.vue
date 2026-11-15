<template>
    <Card class="h-full" :pt="{ body: { class: 'p-0 h-full' }, content: { class: 'p-0 h-full' } }">
        <template #content>
            <div class="flex flex-col h-full">
                <div class="stage-header">
                    <Tabs v-model:value="activeStageTab">
                        <TabList>
                            <Tab v-for="tab in tabs" :key="tab.value" :value="tab.value">
                                <i :class="tab.icon" class="mr-2"></i>{{ tab.label }}
                            </Tab>
                        </TabList>
                    </Tabs>
                    <div class="stage-actions">
                        <Button
                            v-tooltip.bottom="'Import stage…'"
                            text
                            size="small"
                            label="Import"
                            icon="mdi mdi-upload"
                            @click="importStage"
                        />
                        <Button
                            v-tooltip.bottom="'Export stage…'"
                            text
                            size="small"
                            label="Export"
                            icon="mdi mdi-content-save"
                            @click="exportStage"
                        />
                    </div>
                </div>

                <div class="content">
                    <Controllers v-if="activeStageTab === STAGE_TAB_CONTROLLERS" />
                    <Visualization v-else-if="activeStageTab === STAGE_TAB_VISUALIZATION" />
                    <Groups v-else-if="activeStageTab === STAGE_TAB_GROUPS" />
                </div>
            </div>
        </template>
    </Card>
</template>

<script setup lang="ts">
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import Card from "primevue/card";
import Button from "primevue/button";
import { useToast } from "primevue/usetoast";

import { getNativeAdapter } from "@/native";
import { useStage } from "@/stage";
import { useErrorHandler } from "@/utils";
import { activeStageTab, STAGE_TAB_CONTROLLERS, STAGE_TAB_GROUPS, STAGE_TAB_VISUALIZATION } from "./stageViewState";

import Controllers from "@/stage/components/Controllers.vue";
import Visualization from "@/stage/components/Visualization.vue";
import Groups from "@/stage/components/Groups.vue";

const toast = useToast();
const errorHandler = useErrorHandler();
const stage = useStage();
const nativeAdapter = getNativeAdapter();

const tabs = [
    { label: "Visualization", icon: "mdi mdi-eye", value: STAGE_TAB_VISUALIZATION },
    { label: "Controllers", icon: "mdi mdi-chip", value: STAGE_TAB_CONTROLLERS },
    { label: "Groups", icon: "mdi mdi-lamps", value: STAGE_TAB_GROUPS },
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
.stage-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-right: 0.75rem;
}

.stage-actions {
    margin-left: auto;
    display: flex;
    gap: 0.25rem;
}

.content {
    margin: 1rem;
    display: flex;
    min-height: 0;
    height: 100%;
    width: calc(100% - 2rem);
}
</style>
