<template>
    <canvas ref="canvas" class="option-canvas"></canvas>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { Color, toChroma } from "../colors";

const props = defineProps({
    modelValue: { type: Array as () => Color[], required: true },
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

    if (!props.modelValue || props.modelValue.length === 0) {
        return;
    }

    const grad = ctx.createLinearGradient(0, 0, width, 0);
    props.modelValue.forEach((v, i) => {
        grad.addColorStop(i / props.modelValue.length, toChroma(v).css());
    });

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
}

watch(() => props.modelValue, draw);
</script>
