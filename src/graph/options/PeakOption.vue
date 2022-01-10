<template>
    <canvas ref="canvas" class="option-canvas"></canvas>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

const props = defineProps({
    modelValue: { type: Number, required: true },
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

    if (!props.modelValue) {
        return;
    }

    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, "green");
    grad.addColorStop(0.5, "orange");
    grad.addColorStop(1, "red");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, props.modelValue * width, height);
}

watch(() => props.modelValue, draw);
</script>
