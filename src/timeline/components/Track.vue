<template>
    <div class="track">
        <div class="track-header">
            <div class="__title">{{ track.name }}</div>
            <div class="__actions" v-if="confirmRemove">
                <div class="text-caption">Remove?</div>
                <Button text size="small" @click="remove">Yes</Button>
                <Button text size="small" @click="confirmRemove = false">No</Button>
            </div>
            <div class="__actions" v-else>
                <Button text size="small" icon="mdi mdi-pencil" @click="settingsOpen = true"> </Button>
                <Button text size="small" icon="mdi mdi-chevron-up" @click="moveUp"> </Button>
                <Button text size="small" icon="mdi mdi-chevron-down" @click="moveDown"> </Button>
                <Button text size="small" icon="mdi mdi-close" @click="confirmRemove = true"> </Button>
            </div>
        </div>
        <div
            class="item-container"
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
import Button from "primevue/button";

import { Track, useTimeline } from "../model";
import TimelineItem from "./TimelineItem.vue";
import TrackSettings from "./TrackSettings.vue";

const props = defineProps({
    track: { type: Object as () => Track, required: true },
});

defineEmits(["dragStart", "mouseenter", "mouseleave", "mousemove"]);

const timeline = useTimeline();

const settingsOpen = ref(false);
const confirmRemove = ref(false);

const items = computed(() => timeline.items.filter((i) => i.trackId === props.track.id));

const unitWidth = computed(() => {
    return timeline.unitWidth;
});

function moveUp() {
    timeline.moveTrack(props.track, "up");
}

function moveDown() {
    timeline.moveTrack(props.track, "down");
}

function remove() {
    items.value.forEach((i) => timeline.removeItem(i));
    timeline.removeTrack(props.track);
}
</script>

<style scoped>
.track {
    height: var(--rowHeight);
    border-bottom: 1px solid var(--p-form-field-disabled-background);
    display: flex;
    z-index: 3;
}

.track-header {
    position: sticky;
    left: 0;
    min-width: var(--headerWidth);
    max-width: var(--headerWidth);
    height: 100%;
    background-color: var(--p-form-field-background);
    color: var(--p-text-color);
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: center;
    z-index: 6;
}

.track-header .__title {
    display: flex;
    align-items: center;
    justify-content: center;
}

.track-header .__actions {
    margin-top: 0.5rem;
    opacity: 0.3;
    transition: opacity 0.2s linear;
}

.track-header:hover .__actions {
    opacity: 1;
}

.item-container {
    position: relative;
    width: 100%;
    height: 100%;
}
</style>
