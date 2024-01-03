<template>
    <div ref="rootEl" class="stage-editor">
        <div>
            <TabMenu v-model:active-index="activeTab" :model="tabMenuItems" />
        </div>
        <div class="h-full min-h-0">
            <KeepAlive>
                <StageSettings v-if="activeTab === 0" v-model:stage="stage"></StageSettings>
                <StageView v-else-if="activeTab === 1 && stage.scene" v-model:stage="stage"></StageView>
            </KeepAlive>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import TabMenu, { TabMenuProps } from "primevue/tabmenu";

import { StageLibraryItem } from "./stage.libraryItem";
import StageSettings from "./StageSettings.vue";
import StageView from "./StageView.vue";

const stage = defineModel<StageLibraryItem>("stage", { required: true });

const activeTab = ref(0);
const tabMenuItems = computed<TabMenuProps["model"]>(() => [
    { label: "Settings", icon: "mdi mdi-cog-outline" },
    { label: "Stage", icon: "mdi mdi-cast-variant", disabled: !stage.value.scene },
]);
</script>

<style scoped>
.stage-editor {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: min-content 1fr;
}
</style>
