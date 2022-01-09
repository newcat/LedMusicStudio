<template>
    <canvas ref="canvas" class="option-canvas"></canvas>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

@Component
export default class SpectrumOption extends Vue {
    @Prop()
    public value?: Float32Array;

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

        if (!this.value || !(this.value instanceof Float32Array)) {
            return;
        }

        const barWidth = width / this.value.length;

        this.value.forEach((v, i) => {
            const b = 255 * v;
            this.ctx.fillStyle = `rgb(${b}, ${b}, ${b})`;
            this.ctx.fillRect(i * barWidth, 0, barWidth, height);
        });
    }
}
</script>
