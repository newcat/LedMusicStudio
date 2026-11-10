/**
 * Realistic movement followers (research R6). Pure logic, no three.js dependency.
 *
 * Each frame the follower is limited by speed and acceleration:
 *   desiredV = sign(err) · min(vMax, √(2·a·|err|))
 *   v ← clamp(v + clamp(desiredV − v, ±a·dt), ±vMax)
 *   x ← x + v·dt
 */

/** Below this error (degrees or slots) and at low speed, the follower snaps onto the target. */
const SNAP_DISTANCE = 0.01;
/** Speed (degrees/s) under which a follower counts as at rest for snapping. */
const SNAP_SPEED = 1;

/** Moves a value (pan/tilt in degrees, zoom, ...) with limited speed and acceleration. */
export class AxisFollower {
    private x = 0;
    private v = 0;
    private target = 0;
    private maxSpeed: number;
    private readonly accel: number;

    constructor(maxSpeed: number, accel = 2000) {
        this.maxSpeed = Math.max(0, maxSpeed);
        this.accel = Math.max(0, accel);
    }

    /** Current value. */
    get value(): number {
        return this.x;
    }

    /** Current speed in units per second. */
    get speed(): number {
        return this.v;
    }

    /** Retargets the move. The current speed is kept, so the move redirects smoothly. */
    setTarget(x: number): void {
        this.target = x;
    }

    setMaxSpeed(v: number): void {
        this.maxSpeed = Math.max(0, v);
    }

    /** Jumps to x without any motion; the target and the speed are reset to x. */
    snap(x: number): void {
        this.x = x;
        this.target = x;
        this.v = 0;
    }

    /** Advances by dt seconds and returns the new value. */
    update(dt: number): number {
        if (dt <= 0) {
            return this.x;
        }
        const err = this.target - this.x;
        const brake = Math.sqrt(2 * this.accel * Math.abs(err));
        const desiredV = Math.sign(err) * Math.min(this.maxSpeed, brake);
        const maxDelta = this.accel * dt;
        const dv = Math.min(maxDelta, Math.max(-maxDelta, desiredV - this.v));
        this.v = Math.min(this.maxSpeed, Math.max(-this.maxSpeed, this.v + dv));
        this.x += this.v * dt;

        const remaining = this.target - this.x;
        if (Math.abs(remaining) < SNAP_DISTANCE && Math.abs(this.v) < SNAP_SPEED) {
            this.snap(this.target);
        }
        return this.x;
    }
}

/**
 * Moves a color or gobo wheel position in slot units. It moves at a fixed 4 slots/s (≈ 0.25 s per slot),
 * takes the shorter way round, and wraps into [0, slotCount) for continuous rotation.
 */
export class WheelFollower {
    static readonly SLOTS_PER_SECOND = 4;

    private pos = 0;
    private target = 0;
    private readonly slotCount: number;

    constructor(slotCount: number) {
        this.slotCount = Math.max(1, slotCount);
    }

    /** Current position in slot units, in [0, slotCount). */
    get position(): number {
        return this.pos;
    }

    /** Sets the wanted slot position; it is wrapped into the wheel and approached the short way round. */
    setTarget(slot: number): void {
        this.target = this.wrap(slot);
    }

    /** Jumps to a slot position without motion. */
    snap(slot: number): void {
        this.pos = this.wrap(slot);
        this.target = this.pos;
    }

    /** Moves the position by a number of slots, for continuous rotation (wraps around). */
    advance(slots: number): void {
        this.pos = this.wrap(this.pos + slots);
        this.target = this.pos;
    }

    /** Advances by dt seconds and returns the new position. */
    update(dt: number): number {
        if (dt <= 0) {
            return this.pos;
        }
        const n = this.slotCount;
        const diff = this.wrap(this.target - this.pos + n / 2) - n / 2;
        const step = WheelFollower.SLOTS_PER_SECOND * dt;
        if (Math.abs(diff) <= step) {
            this.pos = this.target;
        } else {
            this.pos = this.wrap(this.pos + Math.sign(diff) * step);
        }
        return this.pos;
    }

    private wrap(slot: number): number {
        const n = this.slotCount;
        return ((slot % n) + n) % n;
    }
}
