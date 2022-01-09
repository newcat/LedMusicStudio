import { Node } from "@baklavajs/core";
import { ICalculationData } from "../../types";
import { wasmInterop } from "@/wasmInterop";

export class ParticleNode extends Node {
    public type = "Particle";
    public name = this.type;

    private wasmParticleNode = new wasmInterop.wasmModule.ParticleNode();

    constructor() {
        super();

        this.addInputInterface("Emit", "CheckboxOption", true, { type: "boolean" });
        this.addInputInterface("Rate", "NumberOption", 10, { type: "number" });
        this.addInputInterface("Start Velocity", "NumberOption", 0.3, { type: "number" });
        this.addInputInterface("End Velocity", "NumberOption", 0.05, { type: "number" });
        this.addInputInterface("Randomness", "NumberOption", 0.01, { type: "number" });
        this.addInputInterface("Glow", "NumberOption", 0.05, { type: "number" });
        this.addInputInterface("Emitter Position", "SliderOption", 0.5, { type: "number", min: 0, max: 1 });
        this.addInputInterface("Symmetric", "CheckboxOption", true, { type: "boolean" });
        this.addInputInterface("Lifetime", "NumberOption", 1, { type: "number" });
        this.addInputInterface("Start Color", "ColorOption", [173, 216, 230], { type: "color_single" });
        this.addInputInterface("End Color", "ColorOption", [0, 0, 0], { type: "color_single" });

        this.addOutputInterface("Output", { type: "color_array" });
    }

    // ~4ms JS, ~0.17ms Rust with opt-level=3 and lto=true
    public calculate(data: ICalculationData) {
        const { fps, resolution } = data;
        const emit = this.getInterface("Emit").value;
        const rate = this.getInterface("Rate").value;
        const randomness = this.getInterface("Randomness").value;
        const glow = this.getInterface("Glow").value;
        const startVelocity = this.getInterface("Start Velocity").value;
        const endVelocity = this.getInterface("End Velocity").value;
        const emitterPosition = this.getInterface("Emitter Position").value;
        const symmetric = this.getInterface("Symmetric").value;
        const lifetimeInFrames = this.getInterface("Lifetime").value;
        const startColor = this.getInterface("Start Color").value;
        const endColor = this.getInterface("End Color").value;
        const calculationData = new wasmInterop.wasmModule.CalculationData(
            fps,
            resolution,
            emit,
            rate,
            startVelocity,
            endVelocity,
            randomness,
            glow,
            emitterPosition,
            symmetric,
            lifetimeInFrames,
            startColor,
            endColor
        );
        this.wasmParticleNode.calculate(calculationData);
        calculationData.free();

        const flattenedOutputBuffer = this.wasmParticleNode.get_output_buffer();
        const output = [];
        for (let i = 0; i < flattenedOutputBuffer.length; i += 3) {
            output.push([flattenedOutputBuffer[i], flattenedOutputBuffer[i + 1], flattenedOutputBuffer[i + 2]]);
        }
        this.getInterface("Output").value = output;
    }
}
