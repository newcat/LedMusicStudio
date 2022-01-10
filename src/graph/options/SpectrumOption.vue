<template>
    <canvas ref="canvas" class="option-canvas"></canvas>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

const props = defineProps({
    modelValue: { type: Object as () => Float32Array, required: true },
});

const canvas = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D;

onMounted(() => {
    ctx = canvas.value!.getContext("2d")!;
    draw();
});

function draw() {
    if (!canvas.value || !ctx) {
        return;
    }

    const { width, height } = canvas.value;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    if (!props.modelValue || !(props.modelValue instanceof Float32Array)) {
        return;
    }

    const barWidth = width / props.modelValue.length;

    props.modelValue.forEach((v, i) => {
        const b = 255 * v;
        ctx.fillStyle = `rgb(${b}, ${b}, ${b})`;
        ctx.fillRect(i * barWidth, 0, barWidth, height);
    });
}

watch(() => props.modelValue, draw);
</script>
