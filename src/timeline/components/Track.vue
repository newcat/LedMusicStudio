<template>
    <div class="track">
        <div class="track-header">
            <div class="__title">{{ track.name }}</div>
            <div class="__target">
                <ClipTargetChip :target="track.defaultTarget" :effective="track.defaultTarget" :allow-inherit="false" @update:target="setTarget" />
            </div>
            <div v-if="confirmRemove" class="__actions">
                <div class="text-caption">Remove?</div>
                <Button text size="small" @click="remove">Yes</Button>
                <Button text size="small" @click="confirmRemove = false">No</Button>
            </div>
            <div v-else class="__actions">
                <Button text size="small" icon="mdi mdi-pencil" @click="settingsOpen = true"> </Button>
                <Button text size="small" icon="mdi mdi-chevron-up" @click="moveUp"> </Button>
                <Button text size="small" icon="mdi mdi-chevron-down" @click="moveDown"> </Button>
                <Button text size="small" icon="mdi mdi-close" @click="confirmRemove = true"> </Button>
            </div>
        </div>
        <div class="item-container">
            <timeline-item
                v-for="item in items"
                :key="item.id"
                :item="item"
                :unit-width="unitWidth"
                @drag-start="(area: ItemArea, ev: MouseEvent) => $emit('dragStart', item, area, ev)"
            ></timeline-item>
        </div>
        <track-settings v-model="settingsOpen" :track="track"></track-settings>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "primevue/button";

import { Item, Track, useTimeline, type ClipTarget } from "../model";
import type { ItemArea } from "../types";
import TimelineItem from "./TimelineItem.vue";
import TrackSettings from "./TrackSettings.vue";
import ClipTargetChip from "./ClipTargetChip.vue";

const props = defineProps({
    track: { type: Object as () => Track, required: true },
});

defineEmits<{ dragStart: [item: Item, area: ItemArea, ev: MouseEvent] }>();

const timeline = useTimeline();

const settingsOpen = ref(false);
const confirmRemove = ref(false);

const items = computed(() => timeline.itemsByTrack.get(props.track.id) ?? []);

const unitWidth = computed(() => {
    return timeline.unitWidth;
});

function moveUp() {
    timeline.edit("Move track", () => timeline.moveTrack(props.track, "up"));
}

function moveDown() {
    timeline.edit("Move track", () => timeline.moveTrack(props.track, "down"));
}

function remove() {
    timeline.edit("Remove track", () => {
        items.value.slice().forEach((i) => timeline.removeItem(i));
        timeline.removeTrack(props.track);
    });
}

function setTarget(value: ClipTarget) {
    const track = timeline.getTrackById(props.track.id);
    if (!track || value === "inherit") {
        return;
    }
    timeline.edit("Track target", () => {
        track.defaultTarget = value ? { ...value } : null;
    });
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

.track-header .__target {
    display: flex;
    justify-content: center;
    margin-top: 0.25rem;
    padding: 0 0.5rem;
}

.track-header .__actions {
    margin-top: 0.25rem;
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
