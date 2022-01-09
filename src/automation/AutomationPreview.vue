<template>
    <svg ref="el" class="automation-clip">
        <template v-for="(p, i) in points">
            <template v-if="i &gt; 0">
                <template v-if="p.type === 'linear'">
                    <line
                        :key="p.id"
                        :x1="getXCoordinate(points[i - 1].unit)"
                        :x2="getXCoordinate(p.unit)"
                        :y1="getYCoordinate(points[i - 1].value)"
                        :y2="getYCoordinate(p.value)"
                    ></line>
                </template>
                <template v-else-if="p.type === 'step'">
                    <line
                        :key="p.id + '-1'"
                        :x1="getXCoordinate(points[i - 1].unit)"
                        :x2="getXCoordinate(p.unit)"
                        :y1="getYCoordinate(points[i - 1].value)"
                        :y2="getYCoordinate(points[i - 1].value)"
                    ></line>
                    <line
                        :key="p.id + '-2'"
                        :x1="getXCoordinate(p.unit)"
                        :x2="getXCoordinate(p.unit)"
                        :y1="getYCoordinate(points[i - 1].value)"
                        :y2="getYCoordinate(p.value)"
                    ></line>
                </template>
            </template>
        </template>
    </svg>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { AutomationLibraryItem } from "./automation.libraryItem";
import { Item } from "@/timeline";

const props = defineProps({
    item: { type: Object as () => Item, required: true },
    unitWidth: { type: Number, required: true },
});

const el = ref<HTMLElement | null>(null);
const height = ref(50);
const resizeObserver = ref<ResizeObserver | null>(null);

const libraryItem = computed(() => props.item.libraryItem as AutomationLibraryItem);
const points = computed(() => libraryItem.value.points);

onMounted(() => {
    resizeObserver.value = new ResizeObserver(() => {
        height.value = el.value!.clientHeight;
    });
    resizeObserver.value.observe(el.value!);
});

onBeforeUnmount(() => {
    resizeObserver.value?.disconnect();
});

function getXCoordinate(unit: number) {
    return unit * props.unitWidth;
}

function getYCoordinate(value: number) {
    return (1 - value) * height.value;
}
</script>

<style lang="scss" scoped>
.automation-clip {
    width: 100%;
    height: 100%;
    & line {
        stroke: white;
        fill: white;
    }
}
</style>
