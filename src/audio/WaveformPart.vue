<template>
    <canvas ref="canvasEl" :style="styles"></canvas>
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from "vue";
import { IWaveformPart } from "./audio.libraryItem";

const canvasEl = ref<HTMLCanvasElement | null>(null);

const props = defineProps<{
    totalParts: number;
    part: IWaveformPart;
}>();

const styles = computed(() => {
    return {
        left: `${100 * (props.part.start / props.totalParts)}%`,
        width: `${100 * ((props.part.end - props.part.start) / props.totalParts)}%`,
    };
});

onMounted(() => {
    const ctx = canvasEl.value!.getContext("2d");
    ctx!.drawImage(props.part.canvas, 0, 0, canvasEl.value!.width, canvasEl.value!.height);
});
</script>
