<template>
    <div class="timeline-item" :class="{ '--selected': item.selected }" :style="styles" @mousedown.self="dragStart('center')">
        <div class="timeline-item__header" :title="name" @mousedown="dragStart('center')">
            <div class="timeline-item__header-text">{{ name }}</div>
        </div>
        <div class="drag-handle --left" v-show="item.resizable &amp;&amp; item.selected" @mousedown="dragStart('leftHandle')"></div>
        <div class="drag-handle --right" v-show="item.resizable &amp;&amp; item.selected" @mousedown="dragStart('rightHandle')"></div>
        <div class="preview-container" v-if="previewComponent" @mousedown="dragStart('center')">
            <component :is="previewComponent" :item="item" :unitWidth="unitWidth"></component>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Item } from "../model/item";
import { ItemArea } from "../types";
import { LibraryItemType } from "@/library";

import { markRaw, computed, ComponentOptions } from "vue";
import AudioPreview from "@/audio/AudioPreview.vue";
import AutomationPreview from "@/automation/AutomationPreview.vue";
import GraphPreview from "@/graph/GraphPreview.vue";
import PatternPreview from "@/pattern/PatternPreview.vue";

const ITEM_COMPONENT_MAPPING: Record<LibraryItemType, ComponentOptions<any>> = markRaw({
    [LibraryItemType.AUDIO]: AudioPreview,
    [LibraryItemType.GRAPH]: GraphPreview,
    [LibraryItemType.AUTOMATION]: AutomationPreview,
    [LibraryItemType.PATTERN]: PatternPreview,
});

const props = defineProps({
    item: { type: Object as () => Item, required: true },
    unitWidth: { type: Number, required: true },
});

const emit = defineEmits(["dragStart"]);

const name = computed(() => {
    return props.item.libraryItem.name ?? "";
});

const styles = computed(() => {
    return {
        transform: `translateX(${props.item.start * props.unitWidth}px)`,
        width: `${(props.item.end - props.item.start) * props.unitWidth}px`,
    };
});

const previewComponent = computed(() => {
    return ITEM_COMPONENT_MAPPING[props.item.libraryItem.type];
});

function dragStart(area: ItemArea) {
    emit("dragStart", area);
}
</script>

<style scoped>
.timeline-item {
    display: flex;
    flex-direction: column;
    position: absolute;
    height: calc(100% - 10px);
    top: 5px;
    background-color: var(--p-mask-background);
    border-radius: 3px;
    border: 2px solid transparent;
    transition: border-color 0.1s;
    z-index: 0;
}

.timeline-item:hover:not(.--selected) {
    border-color: var(--p-primary-hover-color);
}

.timeline-item.--selected {
    border-color: var(--p-primary-color);
    z-index: 1;
}

.timeline-item__header {
    width: 100%;
    background: rgba(0, 0, 0, 0.5);
}

.timeline-item__header-text {
    color: var(--p-text-color);
    font-size: 0.75rem;
    padding: 0.1rem;
    margin-left: 5px;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
}

.preview-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
}

.drag-handle {
    position: absolute;
    height: 50%;
    width: 6px;
    top: 25%;
    background-color: var(--p-primary-color);
    cursor: col-resize;
}

.drag-handle.--left {
    left: -6px;
    border-radius: 3px 0 0 3px;
}

.drag-handle.--right {
    right: -6px;
    border-radius: 0 3px 3px 0;
}
</style>
