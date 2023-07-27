<template>
    <div class="timeline-item" :class="{ '--selected': item.selected }" :style="styles" @mousedown.self="dragStart('center')">
        <div class="timeline-item__header" :title="name" @mousedown="dragStart('center')">
            <div class="timeline-item__header-text">{{ name }}</div>
        </div>
        <div class="__drag-handle --left" v-show="item.resizable &amp;&amp; item.selected" @mousedown="dragStart('leftHandle')"></div>
        <div class="__drag-handle --right" v-show="item.resizable &amp;&amp; item.selected" @mousedown="dragStart('rightHandle')"></div>
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

const ITEM_COMPONENT_MAPPING: Record<LibraryItemType, ComponentOptions<any> | null> = markRaw({
    [LibraryItemType.AUDIO]: AudioPreview,
    [LibraryItemType.GRAPH]: GraphPreview,
    [LibraryItemType.AUTOMATION]: AutomationPreview,
    [LibraryItemType.PATTERN]: PatternPreview,
    [LibraryItemType.OUTPUT]: null,
    [LibraryItemType.STAGE]: null,
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
