<template>
    <div ref="rootEl" class="stage-editor">
        <div>
            <TabMenu v-model:active-index="activeTab" :model="tabMenuItems" />
        </div>
        <div class="h-full min-h-0">
            <KeepAlive>
                <StageView v-if="activeTab === 0 && stage.scene" v-model:stage="stage"></StageView>
                <StageSettings v-else v-model:stage="stage"></StageSettings>
            </KeepAlive>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import TabMenu, { TabMenuProps } from "primevue/tabmenu";

import { StageLibraryItem } from "./stage.libraryItem";
import StageSettings from "./StageSettings.vue";
import StageView from "./StageView.vue";

const stage = defineModel<StageLibraryItem>("stage", { required: true });

const activeTab = ref(0);
const tabMenuItems = computed<TabMenuProps["model"]>(() => [
    { label: "Stage", icon: "mdi mdi-cast-variant", disabled: !stage.value.scene },
    { label: "Settings", icon: "mdi mdi-cog-outline" },
]);

onMounted(() => {
    if (!stage.value.scene) {
        activeTab.value = 1;
    }
});
</script>

<style scoped>
.stage-editor {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: min-content 1fr;
}
</style>
