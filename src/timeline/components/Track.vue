<template>
    <div class="__track">
        <div class="__header">
            <div class="__title">{{ track.name }}</div>
            <div class="__actions" v-if="confirmRemove">
                <div class="text-caption">Remove?</div>
                <n-button size="tiny" @click="remove">Yes</n-button>
                <n-button size="tiny" @click="confirmRemove = false">No</n-button>
            </div>
            <div class="__actions" v-else>
                <n-button text size="tiny" @click="settingsOpen = true">
                    <n-icon><create-filled /></n-icon>
                </n-button>
                <n-button text size="tiny" @click="moveUp">
                    <n-icon><keyboard-arrow-up-filled /></n-icon>
                </n-button>
                <n-button text size="tiny" @click="moveDown">
                    <n-icon><keyboard-arrow-down-filled /></n-icon>
                </n-button>
                <n-button text size="tiny" @click="confirmRemove = true">
                    <n-icon><close-filled /></n-icon>
                </n-button>
            </div>
        </div>
        <div
            class="__item-container"
            @mouseenter="$emit('mouseenter', $event)"
            @mouseleave="$emit('mouseleave', $event)"
            @mousemove="$emit('mousemove', $event)"
        >
            <timeline-item
                v-for="item in items"
                :key="item.id"
                :item="item"
                :unitWidth="unitWidth"
                @drag-start="$emit('dragStart', item, $event)"
            ></timeline-item>
        </div>
        <track-settings v-model="settingsOpen" :track="track"></track-settings>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NIcon } from "naive-ui";
import { CreateFilled, KeyboardArrowUpFilled, KeyboardArrowDownFilled, CloseFilled } from "@vicons/material";

import { Track, TimelineEditor } from "../model";
import TimelineItem from "./TimelineItem.vue";
import TrackSettings from "./TrackSettings.vue";

const props = defineProps({
    editor: { type: Object as () => TimelineEditor, required: true },
    track: { type: Object as () => Track, required: true },
});

defineEmits(["dragStart", "mouseenter", "mouseleave", "mousemove"]);

const settingsOpen = ref(false);
const confirmRemove = ref(false);

const items = computed(() => {
    return props.editor ? props.editor.items.filter((i) => i.trackId === props.track.id) : [];
});

const unitWidth = computed(() => {
    return props.editor.unitWidth;
});

function moveUp() {
    props.editor.moveTrack(props.track, "up");
}

function moveDown() {
    props.editor.moveTrack(props.track, "down");
}

function remove() {
    items.value.forEach((i) => props.editor.removeItem(i));
    props.editor.removeTrack(props.track);
}
</script>
