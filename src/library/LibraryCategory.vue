<template>
    <n-h3 prefix="bar" align-text>{{ name }}</n-h3>
    <library-item v-for="item in items" :key="item.id" :item="item" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NH3 } from "naive-ui";

import { globalState } from "@/globalState";
import { LibraryItemType } from "./libraryItem";
import LibraryItem from "./LibraryItem.vue";

const props = defineProps({
    name: { type: String, required: true },
    type: { type: Number as () => LibraryItemType, required: true },
});

const items = computed(() => {
    return globalState.library.items.filter((i) => i.type === props.type);
});
</script>
