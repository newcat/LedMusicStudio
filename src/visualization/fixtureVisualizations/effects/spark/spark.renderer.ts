/**
 * Cold spark (feature 003, T065): bright additive sparks thrown up from the nozzle while the trigger is on.
 *
 * Each spark is two points: the head and a trail point that shows where the head was one frame earlier. The trail
 * is not integrated; the head writes its previous position into the trail's record every frame.
 *
 * Space: the particles live in `effectOrigin` space, so gravity and the launch direction are converted from world
 * space to local space with the origin's world rotation (read once per frame). Sparks are therefore ballistic in
 * world space for a static nozzle; a moving nozzle carries its sparks along (an approximation, acceptable for a
 * fixture that is not moving fast).
 *
 * Light: a warm `omni` light while on. Its brightness is proportional to the height the sparks have visibly reached
 * (full brightness only at `maxHeight`): after the trigger, it follows the ballistic rise of the first sparks, so it
 * ramps up until they have reached their apex. After the trigger is released, the light fades out linearly over
 * `LIGHT_FADE_TIME` (the longest spark life, so it goes dark when the last spark dies).
 */
import * as THREE from "three";

import { kelvinToRgb } from "../../../capabilities/colorMath";
import type { FrameContext, RendererInputs } from "../../base.renderer";
import { EffectRenderer, type EffectStateOf } from "../effectRenderer";
import type { Particle } from "../particles";
import { defaultEffectOptions } from "../types";

const GRAVITY = 9.81;
/** Sparks emitted per second while on. */
const SPARK_RATE = 60;
/** Seconds: every spark dies (and so fades out) within 1 s. */
const LIFE_MIN = 0.6;
const LIFE_MAX = 0.9;
/** World-space diameters (m). */
const HEAD_SIZE = 0.05;
const TRAIL_SIZE = 0.03;
/** Brightness of the trail relative to the head. */
const TRAIL_BRIGHTNESS = 0.4;
/** Horizontal launch speed spread (m/s, per axis). */
const HORIZONTAL_SPEED = 0.3;
/** Nozzle position spread (m, per axis). */
const NOZZLE_JITTER = 0.02;
const LIGHT_KELVIN = 3000;
const LIGHT_RANGE = 4;
/** Seconds the light takes to fade out after the trigger is released. */
const LIGHT_FADE_TIME = LIFE_MIN + (LIFE_MAX - LIFE_MIN) / 2;

interface SparkRecord {
    /** True for the trail point, false for the head. */
    trail: boolean;
    /** Slot of the other point of the spark, -1 when there is none. */
    partner: number;
    /**
     * Head: its position at the start of the previous frame. Trail: the position it is drawn at this frame (written by
     * the head).
     */
    last: THREE.Vector3;
}

export class SparkRenderer extends EffectRenderer<"spark"> {
    private readonly particles = this.createEmitter({ additive: true, capacityScale: 2 });
    /** Role and partner of every live particle, by slot. */
    private readonly records = new Map<number, SparkRecord>();
    private readonly warm = kelvinToRgb(LIGHT_KELVIN);

    private readonly localFromWorld = new THREE.Quaternion();
    private readonly gravity = new THREE.Vector3();
    private readonly tmp = new THREE.Vector3();
    private readonly start = new THREE.Vector3();
    private readonly sparkLightColor = new THREE.Color();
    private emitCarry = 0;
    /** Seconds since the trigger turned on (0 while off). */
    private onTime = 0;
    /** Light brightness (0..1) of the last frame while on: the starting level of the fade-out. */
    private lightLevel = 0;
    /** Seconds left of the fade-out after release (0 when not fading). */
    private fadeLeft = 0;

    public constructor(inputs: RendererInputs) {
        super(inputs, defaultEffectOptions("spark"));
    }

    protected step(state: EffectStateOf<"spark">, frame: FrameContext): void {
        const dt = frame.dt;
        this.effectOrigin.getWorldQuaternion(this.localFromWorld).invert();
        this.gravity.set(0, -GRAVITY, 0).applyQuaternion(this.localFromWorld);

        if (state.on && state.height > 0) {
            this.emitCarry += SPARK_RATE * dt;
            const count = Math.floor(this.emitCarry);
            this.emitCarry -= count;
            for (let i = 0; i < count; i++) {
                this.emitSpark(state.height);
            }
        } else {
            this.emitCarry = 0;
        }

        this.updateLight(state, dt);
        this.particles.update(dt, (p) => this.stepParticle(p, dt));
    }

    /**
     * Warm light while on, its brightness proportional to the height the first sparks have reached so far; fades out
     * over `LIGHT_FADE_TIME` after release.
     */
    private updateLight(state: EffectStateOf<"spark">, dt: number): void {
        if (!state.on || state.height <= 0) {
            if (this.onTime > 0) {
                // just released: start the fade-out from the current level
                this.onTime = 0;
                this.fadeLeft = LIGHT_FADE_TIME;
            }
            this.fadeLeft = Math.max(0, this.fadeLeft - dt);
            const level = this.lightLevel * (this.fadeLeft / LIGHT_FADE_TIME);
            if (level <= 0) {
                this.lightLevel = 0;
                this.setOmniLight(null, null, LIGHT_RANGE);
                return;
            }
            this.sparkLightColor.copy(this.warm).multiplyScalar(level);
            this.setOmniLight(this.sparkLightColor, null, LIGHT_RANGE);
            return;
        }
        this.fadeLeft = 0;
        this.onTime += dt;
        // ballistic height of a spark launched when the trigger turned on, clamped at its apex (= state.height)
        const v0 = Math.sqrt(2 * GRAVITY * state.height);
        const t = Math.min(this.onTime, v0 / GRAVITY);
        const visibleHeight = Math.min(state.height, v0 * t - 0.5 * GRAVITY * t * t);
        const maxHeight = this.options.maxHeight;
        const heightRatio = maxHeight > 0 ? Math.min(1, visibleHeight / maxHeight) : 1;
        this.lightLevel = heightRatio;
        this.sparkLightColor.copy(this.warm).multiplyScalar(heightRatio);
        this.setOmniLight(this.sparkLightColor, null, LIGHT_RANGE);
    }

    public override dispose(): void {
        this.records.clear();
        super.dispose();
    }

    /** Emits one spark (head + trail) at the nozzle, launched up to reach `height` (m) in world space. */
    private emitSpark(height: number): void {
        const v0 = Math.sqrt(2 * GRAVITY * height);
        const life = LIFE_MIN + Math.random() * (LIFE_MAX - LIFE_MIN);
        let headSlot = -1;
        let trailSlot = -1;
        this.particles.emit(2, (i, p) => {
            p.life = life;
            p.x = (Math.random() * 2 - 1) * NOZZLE_JITTER;
            p.y = (Math.random() * 2 - 1) * NOZZLE_JITTER;
            p.z = (Math.random() * 2 - 1) * NOZZLE_JITTER;
            if (i === 0) {
                headSlot = p.slot;
                this.start.set(p.x, p.y, p.z);
                // launch velocity: world up at v0 plus a small horizontal spread, converted to local space
                this.tmp
                    .set((Math.random() * 2 - 1) * HORIZONTAL_SPEED, v0, (Math.random() * 2 - 1) * HORIZONTAL_SPEED)
                    .applyQuaternion(this.localFromWorld);
                p.vx = this.tmp.x;
                p.vy = this.tmp.y;
                p.vz = this.tmp.z;
                p.size = HEAD_SIZE;
            } else {
                trailSlot = p.slot;
                p.size = TRAIL_SIZE;
            }
        });
        if (headSlot < 0) {
            return;
        }
        this.setRecord(headSlot, false, trailSlot, this.start);
        if (trailSlot >= 0) {
            this.setRecord(trailSlot, true, headSlot, this.start);
        }
    }

    private setRecord(slot: number, trail: boolean, partner: number, last: THREE.Vector3): void {
        const existing = this.records.get(slot);
        if (existing) {
            existing.trail = trail;
            existing.partner = partner;
            existing.last.copy(last);
        } else {
            this.records.set(slot, { trail, partner, last: last.clone() });
        }
    }

    private stepParticle(p: Particle, dt: number): void {
        const record = this.records.get(p.slot);
        if (!record) {
            p.size = 0;
            return;
        }
        const fade = Math.max(0, 1 - p.age / p.life);
        if (record.trail) {
            // drawn where the head was one frame ago; no motion of its own
            p.x = record.last.x;
            p.y = record.last.y;
            p.z = record.last.z;
            p.vx = 0;
            p.vy = 0;
            p.vz = 0;
            const brightness = TRAIL_BRIGHTNESS * fade;
            p.r = brightness;
            p.g = brightness;
            p.b = brightness;
            return;
        }
        const trail = this.records.get(record.partner);
        if (trail) {
            trail.last.copy(record.last);
        }
        record.last.set(p.x, p.y, p.z);
        p.vx += this.gravity.x * dt;
        p.vy += this.gravity.y * dt;
        p.vz += this.gravity.z * dt;
        p.r = fade;
        p.g = fade;
        p.b = fade;
    }
}
