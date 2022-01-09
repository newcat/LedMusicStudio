<template>
    <canvas ref="canvas" class="option-canvas"></canvas>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import { Color, toChroma } from "../colors";

@Component
export default class PreviewOption extends Vue {
    @Prop({})
    public value!: Color[];

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

        if (!this.value || this.value.length === 0) {
            return;
        }

        const grad = this.ctx.createLinearGradient(0, 0, width, 0);
        this.value.forEach((v, i) => {
            grad.addColorStop(i / this.value.length, toChroma(v).css());
        });

        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, width, height);
    }
}
</script>
