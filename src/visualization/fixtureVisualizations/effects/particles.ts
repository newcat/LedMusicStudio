/**
 * Particle emitter of the effect visualizations (feature 003, T060). Particles live in struct-of-arrays typed arrays
 * with a dead-slot free list; they are drawn as one `THREE.Points` whose attributes are the arrays themselves, so
 * `update` only flags them for upload and sets the draw range.
 */
import * as THREE from "three";
import { NO_SHADOW_LAYER } from "../../layers";
import PARTICLE_VERTEX_SHADER from "./particle.vertex.glsl?raw";
import PARTICLE_FRAGMENT_SHADER from "./particle.fragment.glsl?raw";

/** Minimum projected point size (CSS px); points smaller than this are still visible. */
const MIN_POINT_CSS_PX = 1.5;

/**
 * Material for `ParticleEmitter`: the shared particle shaders, `vertexColors` on. `additive` selects additive
 * blending and the `ADDITIVE` define of the fragment shader; otherwise normal (alpha) blending.
 */
export function createParticleMaterial(options: { additive: boolean }): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        vertexShader: PARTICLE_VERTEX_SHADER,
        fragmentShader: PARTICLE_FRAGMENT_SHADER,
        defines: options.additive ? { ADDITIVE: "" } : {},
        uniforms: {
            uViewportHeight: { value: 1 },
            uMinPointSize: { value: MIN_POINT_CSS_PX },
        },
        vertexColors: true,
        transparent: true,
        blending: options.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
        toneMapped: false,
    });
}

interface ParticleArrays {
    /** Attribute `position`, 3 per slot. */
    position: Float32Array;
    /** Attribute `color` (linear RGB 0..1), 3 per slot. */
    color: Float32Array;
    /** Attribute `aSize` (world units), 1 per slot; 0 hides the slot. */
    size: Float32Array;
    velocity: Float32Array;
    age: Float32Array;
    life: Float32Array;
    alive: Uint8Array;
}

function allocate(capacity: number): ParticleArrays {
    return {
        position: new Float32Array(capacity * 3),
        color: new Float32Array(capacity * 3),
        size: new Float32Array(capacity),
        velocity: new Float32Array(capacity * 3),
        age: new Float32Array(capacity),
        life: new Float32Array(capacity),
        alive: new Uint8Array(capacity),
    };
}

/**
 * Writable view of one particle, passed to the `emit` init and the `update` step callbacks. The same object is reused
 * for every particle, so it is only valid inside the callback.
 */
export class Particle {
    private data: ParticleArrays = allocate(0);
    /** Slot index of the particle (stable while it lives). */
    public slot = 0;

    /** @internal */
    public bind(data: ParticleArrays, slot: number): this {
        this.data = data;
        this.slot = slot;
        return this;
    }

    public get x(): number {
        return this.data.position[this.slot * 3];
    }
    public set x(value: number) {
        this.data.position[this.slot * 3] = value;
    }
    public get y(): number {
        return this.data.position[this.slot * 3 + 1];
    }
    public set y(value: number) {
        this.data.position[this.slot * 3 + 1] = value;
    }
    public get z(): number {
        return this.data.position[this.slot * 3 + 2];
    }
    public set z(value: number) {
        this.data.position[this.slot * 3 + 2] = value;
    }

    public get vx(): number {
        return this.data.velocity[this.slot * 3];
    }
    public set vx(value: number) {
        this.data.velocity[this.slot * 3] = value;
    }
    public get vy(): number {
        return this.data.velocity[this.slot * 3 + 1];
    }
    public set vy(value: number) {
        this.data.velocity[this.slot * 3 + 1] = value;
    }
    public get vz(): number {
        return this.data.velocity[this.slot * 3 + 2];
    }
    public set vz(value: number) {
        this.data.velocity[this.slot * 3 + 2] = value;
    }

    /** Seconds since emission. */
    public get age(): number {
        return this.data.age[this.slot];
    }
    /** Seconds until the particle dies (`age >= life`). */
    public get life(): number {
        return this.data.life[this.slot];
    }
    public set life(value: number) {
        this.data.life[this.slot] = value;
    }

    /** World-space diameter; 0 hides the particle. */
    public get size(): number {
        return this.data.size[this.slot];
    }
    public set size(value: number) {
        this.data.size[this.slot] = value;
    }

    public get r(): number {
        return this.data.color[this.slot * 3];
    }
    public set r(value: number) {
        this.data.color[this.slot * 3] = value;
    }
    public get g(): number {
        return this.data.color[this.slot * 3 + 1];
    }
    public set g(value: number) {
        this.data.color[this.slot * 3 + 1] = value;
    }
    public get b(): number {
        return this.data.color[this.slot * 3 + 2];
    }
    public set b(value: number) {
        this.data.color[this.slot * 3 + 2] = value;
    }
}

export class ParticleEmitter {
    /** One `THREE.Points` on `NO_SHADOW_LAYER`; add it to the scene graph of the effect. */
    public readonly points: THREE.Points;

    private readonly geometry = new THREE.BufferGeometry();
    private readonly material: THREE.ShaderMaterial;
    private readonly view = new Particle();
    private readonly drawingBufferSize = new THREE.Vector2();

    private capacity: number;
    private data: ParticleArrays;
    /** Stack of free slots; `free[0 .. freeCount)` are free, the top is `free[freeCount - 1]`. */
    private free: Uint32Array;
    private freeCount = 0;
    /** One past the highest alive slot: the draw range. */
    private drawCount = 0;

    private positionAttribute!: THREE.BufferAttribute;
    private colorAttribute!: THREE.BufferAttribute;
    private sizeAttribute!: THREE.BufferAttribute;

    /**
     * @param capacity maximum number of live particles (`quality.particlesPerEffect`)
     * @param material from `createParticleMaterial`
     */
    constructor(capacity: number, material: THREE.ShaderMaterial) {
        this.capacity = Math.max(0, Math.floor(capacity));
        this.material = material;
        this.data = allocate(this.capacity);
        this.free = new Uint32Array(this.capacity);
        this.rebuildFreeList();
        this.attachAttributes();

        this.points = new THREE.Points(this.geometry, material);
        this.points.name = "particles";
        // particles never cast shadows (research R11)
        this.points.layers.set(NO_SHADOW_LAYER);
        // positions change every frame, so the cached bounding sphere would be stale
        this.points.frustumCulled = false;
        // particles are not picked
        this.points.raycast = () => undefined;
        this.points.onBeforeRender = (renderer) => {
            const target = renderer.getRenderTarget();
            const height = target ? target.height : renderer.getDrawingBufferSize(this.drawingBufferSize).y;
            const uniforms = this.material.uniforms;
            if (uniforms.uViewportHeight) {
                uniforms.uViewportHeight.value = height;
            }
            if (uniforms.uMinPointSize) {
                uniforms.uMinPointSize.value = MIN_POINT_CSS_PX * renderer.getPixelRatio();
            }
        };
    }

    /**
     * Emits up to `n` particles (fewer when the free list runs out). `init(i, p)` sets the particle's start state; the
     * defaults are position 0, velocity 0, age 0, life 1, size 1, color white. Returns the number emitted.
     */
    public emit(n: number, init: (i: number, p: Particle) => void): number {
        const d = this.data;
        let emitted = 0;
        for (let i = 0; i < n && this.freeCount > 0; i++) {
            this.freeCount--;
            const s = this.free[this.freeCount];
            d.alive[s] = 1;
            d.age[s] = 0;
            d.life[s] = 1;
            d.size[s] = 1;
            d.position.fill(0, s * 3, s * 3 + 3);
            d.velocity.fill(0, s * 3, s * 3 + 3);
            d.color.fill(1, s * 3, s * 3 + 3);
            init(i, this.view.bind(d, s));
            if (s + 1 > this.drawCount) {
                this.drawCount = s + 1;
            }
            emitted++;
        }
        return emitted;
    }

    /**
     * Ages all particles by `dt`, calls `step(p)` on the living ones (set velocity, size, color there), integrates
     * positions and kills the expired ones. Then uploads the attributes and sets the draw range.
     */
    public update(dt: number, step: (p: Particle) => void): void {
        const d = this.data;
        const view = this.view;
        for (let s = 0; s < this.drawCount; s++) {
            if (d.alive[s] === 0) {
                continue;
            }
            d.age[s] += dt;
            if (d.age[s] >= d.life[s]) {
                this.kill(s);
                continue;
            }
            step(view.bind(d, s));
            const p = s * 3;
            d.position[p] += d.velocity[p] * dt;
            d.position[p + 1] += d.velocity[p + 1] * dt;
            d.position[p + 2] += d.velocity[p + 2] * dt;
        }
        while (this.drawCount > 0 && d.alive[this.drawCount - 1] === 0) {
            this.drawCount--;
        }
        this.positionAttribute.needsUpdate = true;
        this.colorAttribute.needsUpdate = true;
        this.sizeAttribute.needsUpdate = true;
        this.geometry.setDrawRange(0, this.drawCount);
    }

    /**
     * Changes the capacity (on a quality change). Live particles keep their slots up to the new capacity; the rest are
     * dropped.
     */
    public resize(capacity: number): void {
        const cap = Math.max(0, Math.floor(capacity));
        if (cap === this.capacity) {
            return;
        }
        const old = this.data;
        const next = allocate(cap);
        const keep = Math.min(cap, this.capacity);
        next.position.set(old.position.subarray(0, keep * 3));
        next.color.set(old.color.subarray(0, keep * 3));
        next.velocity.set(old.velocity.subarray(0, keep * 3));
        next.size.set(old.size.subarray(0, keep));
        next.age.set(old.age.subarray(0, keep));
        next.life.set(old.life.subarray(0, keep));
        next.alive.set(old.alive.subarray(0, keep));

        this.capacity = cap;
        this.data = next;
        this.free = new Uint32Array(cap);
        this.rebuildFreeList();
        this.drawCount = Math.min(this.drawCount, cap);
        while (this.drawCount > 0 && next.alive[this.drawCount - 1] === 0) {
            this.drawCount--;
        }
        // new arrays: drop the GPU buffers of the old ones and attach the new attributes
        this.geometry.dispose();
        this.attachAttributes();
        this.geometry.setDrawRange(0, this.drawCount);
    }

    private kill(s: number): void {
        const d = this.data;
        d.alive[s] = 0;
        d.size[s] = 0; // hidden by the vertex shader
        d.color.fill(0, s * 3, s * 3 + 3);
        this.free[this.freeCount++] = s;
    }

    /** Free stack with every dead slot; the lowest free slot is on top, so emission fills from slot 0. */
    private rebuildFreeList(): void {
        this.freeCount = 0;
        for (let s = this.capacity - 1; s >= 0; s--) {
            if (this.data.alive[s] === 0) {
                this.free[this.freeCount++] = s;
            }
        }
    }

    private attachAttributes(): void {
        const d = this.data;
        this.positionAttribute = new THREE.BufferAttribute(d.position, 3).setUsage(THREE.DynamicDrawUsage);
        this.colorAttribute = new THREE.BufferAttribute(d.color, 3).setUsage(THREE.DynamicDrawUsage);
        this.sizeAttribute = new THREE.BufferAttribute(d.size, 1).setUsage(THREE.DynamicDrawUsage);
        this.geometry.setAttribute("position", this.positionAttribute);
        this.geometry.setAttribute("color", this.colorAttribute);
        this.geometry.setAttribute("aSize", this.sizeAttribute);
    }
}
