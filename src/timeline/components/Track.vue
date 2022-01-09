<template>
    <div class="__track">
        <div class="__header">
            <div class="__title">{{ track.name }}</div>
            <div class="__actions" v-if="confirmRemove">
                <div class="text-caption">Remove?</div>
                <v-btn text="text" x-small="x-small" @click="remove">Yes</v-btn>
                <v-btn text="text" x-small="x-small" @click="confirmRemove = false">No</v-btn>
            </div>
            <div class="__actions" v-else="v-else">
                <v-btn icon="icon" x-small="x-small" @click="settingsOpen = true">
                    <v-icon>create</v-icon>
                </v-btn>
                <v-btn icon="icon" x-small="x-small" @click="moveUp">
                    <v-icon>keyboard_arrow_up</v-icon>
                </v-btn>
                <v-btn icon="icon" x-small="x-small" @click="moveDown">
                    <v-icon>keyboard_arrow_down</v-icon>
                </v-btn>
                <v-btn icon="icon" x-small="x-small" @click="confirmRemove = true">
                    <v-icon>close</v-icon>
                </v-btn>
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
                @drag-start="$emit('dragStart')"
            ></timeline-item>
        </div>
        <track-settings v-model="settingsOpen" :track="track"></track-settings>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
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
