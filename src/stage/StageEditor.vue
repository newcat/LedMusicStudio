<template>
    <div ref="rootEl" class="stage-editor">
        <div>
            <TabMenu v-model:active-index="activeTab" :model="tabMenuItems" />
        </div>
        <div class="h-full min-h-0">
            <KeepAlive>
                <StageSettings v-if="activeTab === 0" v-model:stage="props.stage"></StageSettings>
                <StageView v-else-if="activeTab === 1" v-model:stage="props.stage"></StageView>
            </KeepAlive>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import TabMenu, { TabMenuProps } from "primevue/tabmenu";

import { StageLibraryItem } from "./stage.libraryItem";
import StageSettings from "./StageSettings.vue";
import StageView from "./StageView.vue";

const props = defineProps<{
    stage: StageLibraryItem;
}>();

const activeTab = ref(0);
const tabMenuItems: TabMenuProps["model"] = [
    { label: "Settings", icon: "mdi mdi-cog-outline" },
    { label: "Stage", icon: "mdi mdi-cast-variant" },
];
</script>

<style scoped>
.stage-editor {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: min-content 1fr;
}
</style>
