<template>
    <svg ref="el" class="graph">
        <rect v-for="u in keyframeUnits" :key="u" v-bind="getCoordinates(u)"></rect>
    </svg>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Item } from "@/timeline";
import { GraphLibraryItem } from "./graph.libraryItem";

const props = defineProps<{
    item: Item;
    unitWidth: number;
}>();

const el = ref<HTMLElement | null>(null);
const height = ref(50);
const resizeObserver = ref<ResizeObserver | null>(null);

const libraryItem = computed(() => props.item.libraryItem as GraphLibraryItem);
const keyframeUnits = computed(() => {
    const allKeyframes = Array.from(libraryItem.value.keyframeManager.keyframes.values());
    return new Set(allKeyframes.flatMap((k) => k.keyframes).map((k) => k.position));
});

onMounted(() => {
    resizeObserver.value = new ResizeObserver(() => {
        height.value = el.value!.clientHeight;
    });
    resizeObserver.value.observe(el.value!);
});

onBeforeUnmount(() => {
    resizeObserver.value?.disconnect();
});

function getCoordinates(unit: number) {
    const cx = unit * props.unitWidth;
    const cy = height.value * 0.5;
    const DIMENSIONS = 12;
    const BORDER_OFFSET = 2;
    return {
        x: cx - DIMENSIONS / 2 - BORDER_OFFSET,
        y: cy - DIMENSIONS / 2,
        width: DIMENSIONS,
        height: DIMENSIONS,
        transform: `rotate(45 ${cx} ${cy})`
    };
}
</script>

<style scoped>
.graph {
    width: 100%;
    height: 100%;
}

.graph > rect {
    fill: white;
}
</style>
