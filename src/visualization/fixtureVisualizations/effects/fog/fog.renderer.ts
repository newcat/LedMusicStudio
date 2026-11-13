/**
 * Fog / Haze machine renderer (feature 003, T066): large soft normal-blended sprites emitted along the nozzle's +Z at a
 * rate proportional to the output. They drift slowly, grow and live 8 s. The haze type is smaller, sparser and fainter.
 * Each frame the output × `hazeContribution` is reported to the environment (hazer coupling, research R13).
 */
import type { FrameContext, RendererInputs } from "../../base.renderer";
import { EffectRenderer, type EffectStateOf } from "../effectRenderer";
import type { Particle } from "../particles";
import { defaultEffectOptions } from "../types";

const LIFE = 8;
/** Seconds to fade in and out at the ends of a particle's life. */
const FADE_IN = 2;
const FADE_OUT = 3;
/** Time constant (s) with which the drift velocity relaxes towards rest. */
const DRIFT_DAMPING_TIME = 7;
/** Base fog color (linear RGB), scaled by the profile brightness and the particle fade. */
const FOG_COLOR = [0.8, 0.82, 0.86] as const;

interface FogProfile {
    /** Particles per second at full output. */
    rate: number;
    /** Diameter in meters at emission and at the end of the life. */
    startSize: number;
    endSize: number;
    /** Initial speed along +Z, m/s (plus up to 50 % random). */
    speed: number;
    /** Color scale: the sprites are alpha-blended, so a dimmer color reads as a fainter cloud. */
    brightness: number;
}

const PROFILES: Record<"fog" | "haze", FogProfile> = {
    fog: { rate: 30, startSize: 0.5, endSize: 2.5, speed: 0.4, brightness: 0.45 },
    haze: { rate: 14, startSize: 0.25, endSize: 1.2, speed: 0.3, brightness: 0.25 },
};

export class FogRenderer extends EffectRenderer<"fog"> {
    private readonly particles = this.createEmitter({ additive: false });
    /** Fractional particle count carried between frames. */
    private emitCarry = 0;

    public constructor(inputs: RendererInputs) {
        super(inputs, defaultEffectOptions("fog"));
    }

    protected step(state: EffectStateOf<"fog">, frame: FrameContext): void {
        const { fogType, hazeContribution } = this.options;
        const profile = PROFILES[fogType === "haze" ? "haze" : "fog"];
        const output = state.output;
        const dt = frame.dt;

        this.reportHaze(output * hazeContribution);

        // rate ∝ output: no output, no new particles (existing ones age out)
        this.emitCarry += profile.rate * output * dt;
        const count = Math.floor(this.emitCarry);
        this.emitCarry -= count;
        this.particles.emit(count, (_i, p) => {
            p.x = (Math.random() - 0.5) * 0.1;
            p.y = (Math.random() - 0.5) * 0.1;
            p.z = 0.05;
            p.vx = (Math.random() - 0.5) * 0.2;
            p.vy = (Math.random() - 0.5) * 0.2;
            p.vz = profile.speed * (1 + 0.5 * Math.random());
            p.life = LIFE;
            p.size = profile.startSize;
        });

        // slow drift: the velocity relaxes towards rest, the sprite grows over its life
        const damping = Math.exp(-dt / DRIFT_DAMPING_TIME);
        const brightness = profile.brightness * output;
        this.particles.update(dt, (p: Particle) => {
            p.vx *= damping;
            p.vy *= damping;
            p.vz *= damping;
            const t = Math.min(1, p.age / LIFE);
            p.size = profile.startSize + (profile.endSize - profile.startSize) * t;
            const fade = Math.min(1, p.age / FADE_IN) * Math.min(1, (p.life - p.age) / FADE_OUT);
            const k = brightness * fade;
            p.r = FOG_COLOR[0] * k;
            p.g = FOG_COLOR[1] * k;
            p.b = FOG_COLOR[2] * k;
        });
    }
}
