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
    private emitCarry = 0;

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

        this.setOmniLight(state.on ? this.warm : null, null, LIGHT_RANGE);
        this.particles.update(dt, (p) => this.stepParticle(p, dt));
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
