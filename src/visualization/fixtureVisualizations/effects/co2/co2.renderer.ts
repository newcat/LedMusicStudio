import type { FrameContext, RendererInputs } from "../../base.renderer";
import { EffectRenderer, type EffectStateOf } from "../effectRenderer";
import type { Particle } from "../particles";
import { defaultEffectOptions } from "../types";

/** Launch speed of the plume, m/s (T064). Decelerates towards the plume height. */
const LAUNCH_SPEED = 15;
/** Particles per second while the trigger is on. */
const EMISSION_RATE = 150;
/** Particle lifetime range, s: the plume dissipates within ≈ 1.5 s after the trigger ends. */
const LIFE_MIN = 1.2;
const LIFE_MAX = 1.5;
/** Particle diameter at emission and at the end of its life, m (the plume expands). */
const SIZE_START = 0.05;
const SIZE_END = 0.3;
/** Spread of the launch velocity perpendicular to the effect direction, m/s (full width). */
const LATERAL_SPEED = 0.6;
/** Spread of the launch position around the nozzle, m (full width). */
const NOZZLE_RADIUS = 0.02;

/**
 * CO2 jet (feature 003, T064): white normal-blended particles launched along the nozzle's +Z at ≈ 15 m/s and slowed
 * by a drag that brings them to rest at about `height`. Emission follows the trigger; the particles expand and fade
 * over their life. No light.
 */
export class Co2Renderer extends EffectRenderer<"co2"> {
    private readonly particles = this.createEmitter({ additive: false });
    /** Fractional particles carried over between frames. */
    private emitCarry = 0;

    public constructor(inputs: RendererInputs) {
        super(inputs, defaultEffectOptions("co2"));
    }

    protected step(state: EffectStateOf<"co2">, frame: FrameContext): void {
        const dt = frame.dt;
        if (state.on) {
            this.emitCarry += EMISSION_RATE * dt;
            const count = Math.floor(this.emitCarry);
            this.emitCarry -= count;
            this.particles.emit(count, (_i, p) => this.launch(p));
        } else {
            this.emitCarry = 0;
        }

        // exponential drag with a travel distance of ≈ height: v(s) = v0 · exp(-s / height)
        const decay = Math.exp((-LAUNCH_SPEED / Math.max(state.height, 1)) * dt);
        this.particles.update(dt, (p) => {
            p.vx *= decay;
            p.vy *= decay;
            p.vz *= decay;
            const t = Math.min(1, p.age / p.life);
            p.size = SIZE_START + (SIZE_END - SIZE_START) * t;
            // normal blending: fading the color towards black fades the sprite out
            const fade = 1 - t;
            p.r = fade;
            p.g = fade;
            p.b = fade;
        });
    }

    private launch(p: Particle): void {
        p.x = (Math.random() - 0.5) * NOZZLE_RADIUS;
        p.y = (Math.random() - 0.5) * NOZZLE_RADIUS;
        p.vx = (Math.random() - 0.5) * LATERAL_SPEED;
        p.vy = (Math.random() - 0.5) * LATERAL_SPEED;
        p.vz = LAUNCH_SPEED * (0.95 + 0.1 * Math.random());
        p.life = LIFE_MIN + (LIFE_MAX - LIFE_MIN) * Math.random();
        p.size = SIZE_START;
        p.r = 1;
        p.g = 1;
        p.b = 1;
    }
}
