<template>
    <div class="asset-library-panel">
        <div class="header">
            <span class="title">Asset library</span>
            <Button
                icon="pi pi-ellipsis-v"
                text
                rounded
                size="small"
                aria-label="Asset library menu"
                aria-haspopup="true"
                @click="menu?.toggle($event)"
            />
            <Menu ref="menu" :model="menuItems" popup />
        </div>
        <AssetGrid class="grid" :categories="categories" collapsible :open-state="openState" @activate="emit('add', $event)" />
    </div>
</template>

<script lang="ts">
import { reactive } from "vue";
import type { AssetCategory } from "@/assetLibrary/types";

/** Kept for the session, so the sections stay as they were when the panel is mounted again. */
const openState = reactive<Partial<Record<AssetCategory, boolean>>>({});
</script>

<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import Menu from "primevue/menu";
import type { MenuItem } from "primevue/menuitem";

import AssetGrid from "./AssetGrid.vue";

const emit = defineEmits<{
    add: [assetId: string];
    showCredits: [];
}>();

// TODO(002): fixture models can be placed once `store.addFixtureModel` exists (T048, US2), which turns this on.
const showFixtures = false;
const categories: AssetCategory[] = showFixtures ? ["fixtures", "stage", "decoration", "shapes"] : ["stage", "decoration", "shapes"];

const menu = ref<InstanceType<typeof Menu>>();
const menuItems: MenuItem[] = [{ label: "Asset credits", icon: "pi pi-info-circle", command: () => emit("showCredits") }];
</script>

<style scoped>
.asset-library-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    padding: 0.5rem;
    gap: 0.25rem;
}

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.title {
    font-weight: 600;
    font-size: 0.9rem;
}

.grid {
    flex: 1;
    min-height: 0;
}
</style>
