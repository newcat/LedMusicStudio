<template>
    <div class="audio-file">
        <template v-if="libraryItem.waveform">
            <img
                class="waveform-part"
                v-for="p in libraryItem.waveform.parts"
                :key="`${p.start}-${p.end}`"
                :style="getImageStyles(p)"
                :src="p.url"
            />
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { AudioLibraryItem, IWaveformPart } from "./audio.libraryItem";

const props = defineProps({
    item: { type: Object, required: true },
    unitWidth: { type: Number, required: true },
});

const libraryItem = computed(() => props.item.libraryItem as AudioLibraryItem);

function getImageStyles(part: IWaveformPart) {
    return {
        left: `${100 * (part.start / libraryItem.value.waveform!.count)}%`,
        width: `${100 * ((part.end - part.start) / libraryItem.value.waveform!.count)}%`,
    };
}
</script>

<style scoped>
.audio-file {
    width: 100%;
    height: 100%;
    position: relative;
}

.waveform-part {
    position: absolute;
    top: 0;
    height: 100%;
    image-rendering: pixelated;
    pointer-events: none;
}
</style>
