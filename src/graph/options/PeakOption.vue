<template>
    <canvas ref="canvas" class="option-canvas"></canvas>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

@Component
export default class SpectrumOption extends Vue {
    @Prop()
    public value!: number;

    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;

    public mounted() {
        this.canvas = this.$refs.canvas as HTMLCanvasElement;
        this.ctx = this.canvas.getContext("2d")!;
        this.draw();
    }

    @Watch("value")
    public draw() {
        if (!this.canvas || !this.ctx) {
            return;
        }

        const { width, height } = this.canvas;

        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, width, height);

        if (!this.value) {
            return;
        }

        const grad = this.ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, "green");
        grad.addColorStop(0.5, "orange");
        grad.addColorStop(1, "red");

        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.value * width, height);
    }
}
</script>
