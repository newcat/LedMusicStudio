<template>
    <div class="__track">
        <div class="__header">
            <div class="__title">{{ track.name }}</div>
            <div class="__actions" v-if="confirmRemove">
                <div class="text-caption">Remove?</div>
                <Button size="tiny" @click="remove">Yes</Button>
                <Button size="tiny" @click="confirmRemove = false">No</Button>
            </div>
            <div class="__actions" v-else>
                <Button text size="tiny" @click="settingsOpen = true">
                    <span class="mdi mdi-create-filled"></span>
                </Button>
                <Button text size="tiny" @click="moveUp">
                    <span class="mdi mdi-keyboard-arrow-up-filled"></span>
                </Button>
                <Button text size="tiny" @click="moveDown">
                    <span class="mdi mdi-keyboard-arrow-down-filled"></span>
                </Button>
                <Button text size="tiny" @click="confirmRemove = true">
                    <span class="mdi mdi-close-filled"></span>
                </Button>
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
import Button from "primevue/button";

import { Item, Track, useTimeline } from "../model";
import TimelineItem from "./TimelineItem.vue";
import TrackSettings from "./TrackSettings.vue";

const props = defineProps({
    track: { type: Object as () => Track, required: true },
});

defineEmits(["dragStart", "mouseenter", "mouseleave", "mousemove"]);

const timeline = useTimeline();

const settingsOpen = ref(false);
const confirmRemove = ref(false);

const items = computed(() => timeline.items.filter((i) => i.trackId === props.track.id) as Item[]);

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
