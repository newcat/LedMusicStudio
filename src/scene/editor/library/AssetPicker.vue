<template>
    <Dialog v-model:visible="visible" modal header="Replace asset" :style="{ width: '36rem' }" :breakpoints="{ '640px': '95vw' }">
        <div class="picker-body">
            <AssetGrid :categories="categories" :draggable="false" @select="pick" @activate="pick" />
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Dialog from "primevue/dialog";

import type { AssetCategory } from "@/assetLibrary/types";
import AssetGrid from "./AssetGrid.vue";

const props = defineProps<{
    /** Only this category; when omitted (unknown asset), every category except fixtures and shapes. */
    category?: AssetCategory;
}>();

const visible = defineModel<boolean>("visible", { default: false });

const emit = defineEmits<{
    pick: [assetId: string];
}>();

const categories = computed<AssetCategory[]>(() => (props.category ? [props.category] : ["stage", "decoration"]));

function pick(assetId: string) {
    emit("pick", assetId);
    visible.value = false;
}
</script>

<style scoped>
.picker-body {
    height: 60vh;
    min-height: 0;
}
</style>
