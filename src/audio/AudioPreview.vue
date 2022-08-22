<template>
    <div class="audio-file">
        <template v-if="libraryItem.waveform">
            <WaveformPart
                class="waveform-part"
                v-for="p in libraryItem.waveform.parts"
                :key="`${p.start}-${p.end}`"
                :total-parts="libraryItem.waveform.count"
                :part="p"
            />
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { AudioLibraryItem } from "./audio.libraryItem";
import WaveformPart from "./WaveformPart.vue";

const props = defineProps({
    item: { type: Object, required: true },
    unitWidth: { type: Number, required: true },
});

const libraryItem = computed(() => props.item.libraryItem as AudioLibraryItem);
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
