import { CalculateFunction, Node } from "@baklavajs/core";
import { LmsCalculationContext } from "../../types";
import { wasmInterop } from "@/wasmInterop";
import { Color } from "@/graph/colors";
import { CheckboxInterface, ColorArrayInterface, ColorSingleInterface, NumberInterface, SliderInterface } from "@/graph/interfaces";

interface Inputs {
    emit: boolean;
    rate: number;
    startVelocity: number;
    endVelocity: number;
    randomness: number;
    glow: number;
    emitterPosition: number;
    symmetric: boolean;
    lifetime: number;
    startColor: Color;
    endColor: Color;
}

interface Outputs {
    output: Color[];
}

export class ParticleNode extends Node<Inputs, Outputs> {
    public type = "Particle";

    public inputs = {
        emit: new CheckboxInterface("Emit", true),
        rate: new NumberInterface("Rate", 10),
        startVelocity: new NumberInterface("Start Velocity", 0.3),
        endVelocity: new NumberInterface("End Velocity", 0.05),
        randomness: new NumberInterface("Randomness", 0.01),
        glow: new NumberInterface("Glow", 0.05),
        emitterPosition: new SliderInterface("Emitter Position", 0.5, 0, 1),
        symmetric: new CheckboxInterface("Symmetric", true),
        lifetime: new NumberInterface("Lifetime", 1),
        startColor: new ColorSingleInterface("Start Color", [173, 216, 230]),
        endColor: new ColorSingleInterface("End Color", [0, 0, 0]),
    };

    public outputs = {
        output: new ColorArrayInterface("Output"),
    };

    private wasmParticleNode = new wasmInterop.wasmModule.ParticleNode();

    constructor() {
        super();
        this.title = this.type;
        this.initializeIo();
    }

    // ~4ms JS, ~0.17ms Rust with opt-level=3 and lto=true
    public calculate: CalculateFunction<Inputs, Outputs, LmsCalculationContext> = (inputs, { globalValues }) => {
        const { fps, resolution } = globalValues;
        const calculationData = new wasmInterop.wasmModule.CalculationData(
            fps,
            resolution,
            inputs.emit,
            inputs.rate,
            inputs.startVelocity,
            inputs.endVelocity,
            inputs.randomness,
            inputs.glow,
            inputs.emitterPosition,
            inputs.symmetric,
            inputs.lifetime,
            new Uint8Array(inputs.startColor),
            new Uint8Array(inputs.endColor)
        );
        this.wasmParticleNode.calculate(calculationData);
        calculationData.free();

        const flattenedOutputBuffer = this.wasmParticleNode.get_output_buffer();
        const output: Color[] = [];
        for (let i = 0; i < flattenedOutputBuffer.length; i += 3) {
            output.push([flattenedOutputBuffer[i], flattenedOutputBuffer[i + 1], flattenedOutputBuffer[i + 2]]);
        }
        return { output };
    };
}
