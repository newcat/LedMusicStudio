/**
 * Flame projector (feature 003, T063): additive orange → red → dark particles rising along the nozzle's +Z, with
 * noisy lateral jitter, and a flickering warm `omni` light at the column's middle while on.
 *
 * States: off → on → fading (0.3 s, no new particles, light fades out) → off.
 */
import * as THREE from "three";

import { kelvinToRgb } from "@/visualization/capabilities/colorMath";
import type { FrameContext, RendererInputs } from "../../base.renderer";
import { EffectRenderer, type EffectStateOf } from "../effectRenderer";
import { defaultEffectOptions } from "../types";

/** Rise speed of the particles (m/s). Lifetime = height / RISE_SPEED, so the column reaches `height`. */
const RISE_SPEED = 6;
/** New particles per second while on. */
const EMISSION_RATE = 200;
/** Lateral jitter acceleration (m/s²) of the random walk. */
const JITTER_ACCEL = 4;
/** Seconds the flame takes to go out after the trigger is released. */
const FADE_TIME = 0.3;
/** Range of the flame light (m). */
const LIGHT_RANGE = 8;
/** Particle diameter at birth and at death (m). */
const SIZE_BIRTH = 0.05;
const SIZE_DEATH = 0.17;

/** Linear RGB color ramp by age: orange at birth, red at 40 % of life, dark at the end. */
const ORANGE = new THREE.Color(1.0, 0.42, 0.06);
const RED = new THREE.Color(0.85, 0.06, 0.01);
const DARK = new THREE.Color(0.1, 0.01, 0.0);
const RED_AGE = 0.4;

/** Light color at 2000 K, linear RGB at 0..1 brightness (the base applies the gain). */
const FLAME_LIGHT_COLOR = kelvinToRgb(2000);

type Phase = "off" | "on" | "fading";

/** Deterministic 1D value noise in 0..1. */
function hash(n: number): number {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
}

function noise1(x: number): number {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return hash(i) * (1 - u) + hash(i + 1) * u;
}

function rand(): number {
    return Math.random() - 0.5;
}

export class FlameRenderer extends EffectRenderer<"flame"> {
    private readonly particles = this.createEmitter({ additive: true });

    private phase: Phase = "off";
    private fadeLeft = 0;
    private emitRemainder = 0;
    private columnHeight = 0;

    private readonly flameLightPosition = new THREE.Vector3();
    private readonly flameLightColor = new THREE.Color();
    private readonly colorScratch = new THREE.Color();

    public constructor(inputs: RendererInputs) {
        super(inputs, defaultEffectOptions("flame"));
    }

    protected step(state: EffectStateOf<"flame">, frame: FrameContext): void {
        const dt = frame.dt;

        // state machine: off → on → fading → off
        if (state.on) {
            this.phase = "on";
            this.columnHeight = state.height;
        } else if (this.phase === "on") {
            this.phase = "fading";
            this.fadeLeft = FADE_TIME;
        }
        if (this.phase === "fading") {
            this.fadeLeft -= dt;
            if (this.fadeLeft <= 0) {
                this.phase = "off";
                this.emitRemainder = 0;
            }
        }

        // emission (only while on, and only with a column to fill)
        if (this.phase === "on" && this.columnHeight > 0) {
            this.emitRemainder += EMISSION_RATE * dt;
            const count = Math.floor(this.emitRemainder);
            this.emitRemainder -= count;
            const height = this.columnHeight;
            this.particles.emit(count, (_i, p) => {
                p.x = rand() * 0.03;
                p.y = rand() * 0.03;
                p.z = 0;
                p.vx = rand() * 0.4;
                p.vy = rand() * 0.4;
                p.vz = RISE_SPEED * (0.9 + 0.2 * Math.random());
                p.life = (height / RISE_SPEED) * (0.95 + 0.1 * Math.random());
                p.size = SIZE_BIRTH;
                p.r = ORANGE.r;
                p.g = ORANGE.g;
                p.b = ORANGE.b;
            });
        }

        // particles: lateral jitter, size and color ramp by age
        this.particles.update(dt, (p) => {
            p.vx += rand() * JITTER_ACCEL * dt;
            p.vy += rand() * JITTER_ACCEL * dt;
            const damping = Math.max(0, 1 - 0.8 * dt);
            p.vx *= damping;
            p.vy *= damping;

            const t = p.life > 0 ? Math.min(1, p.age / p.life) : 1;
            if (t < RED_AGE) {
                this.colorScratch.lerpColors(ORANGE, RED, t / RED_AGE);
            } else {
                this.colorScratch.lerpColors(RED, DARK, (t - RED_AGE) / (1 - RED_AGE));
            }
            p.r = this.colorScratch.r;
            p.g = this.colorScratch.g;
            p.b = this.colorScratch.b;
            p.size = SIZE_BIRTH + (SIZE_DEATH - SIZE_BIRTH) * t;
        });

        this.updateLight(frame);
    }

    /** Flickering light at the column's middle while on, fading out during `fading`, removed when off. */
    private updateLight(frame: FrameContext): void {
        if (this.phase === "off" || this.columnHeight <= 0) {
            this.setOmniLight(null, null, LIGHT_RANGE);
            return;
        }
        const flicker = 0.8 + 0.2 * noise1(frame.time * 12);
        const fade = this.phase === "fading" ? Math.max(0, this.fadeLeft / FADE_TIME) : 1;
        this.flameLightColor.copy(FLAME_LIGHT_COLOR).multiplyScalar(flicker * fade);
        this.flameLightPosition.set(0, 0, this.columnHeight / 2);
        this.setOmniLight(this.flameLightColor, this.flameLightPosition, LIGHT_RANGE);
    }
}
