/**
 * Abstract base of the effect renderers: Laser, Flame, CO2 Jet, Cold Spark, Fog / Haze (feature 003, T061).
 *
 * The base loads the model body, hangs the `effectOrigin` group at the body's beam anchor (the nozzle), stores the
 * config and the raw DMX values, and decodes them each frame with `decodeEffect`. Subclasses only implement `step`.
 *
 * Writing a subclass (e.g. `flame/flame.renderer.ts`):
 *
 * ```ts
 * export class FlameRenderer extends EffectRenderer<"flame"> {
 *     private readonly particles = this.createEmitter({ additive: true });
 *     public constructor(inputs: RendererInputs) {
 *         super(inputs, defaultEffectOptions("flame"));
 *     }
 *     protected step(state: EffectStateOf<"flame">, frame: FrameContext): void {
 *         // emit along +Z of effectOrigin, update particles, setOmniLight(...)
 *     }
 * }
 * ```
 *
 * - `effectOrigin`: meters (its world scale is kept at 1, whatever the model or object scale), local +Z is the effect
 *   direction. Add effect geometry to it; particles of `createEmitter` are already added.
 * - `options`: the config's options when their `kind` matches, else the defaults passed to the constructor.
 * - Do not override `update`; override `onConfigUpdate` / `dispose` only with a `super` call.
 */
import * as THREE from "three";

import type { FixtureBody } from "@/assetLibrary/fixtureBody";
import { decodeEffect, type EffectKind, type EffectState, type LaserEffectState } from "../../capabilities/effectState";
import { emptyMapping } from "../../capabilities/types";
import type { LightHandle } from "../../lighting/surfaceLighting";
import { BaseRenderer, type FrameContext, type RendererInputs } from "../base.renderer";
import { isInVisibleHierarchy } from "../visibility";
import { createParticleMaterial, ParticleEmitter } from "./particles";
import type { EffectOptionsOf, EffectVisualizationConfig } from "./types";

/** Decoded state handed to `step` for each effect kind. */
export type EffectStateOf<K extends EffectKind> = K extends "laser"
    ? LaserEffectState
    : K extends "fog"
      ? Extract<EffectState, { kind: "fog" }>
      : Extract<EffectState, { kind: "flame" | "co2" | "spark" }>;

/** Surface light output factor of `setOmniLight`: compensates the `1 / (1 + d²)` falloff (as the beam renderer). */
export const OMNI_LIGHT_GAIN = 20;

interface ManagedEmitter {
    emitter: ParticleEmitter;
    /** Capacity = `quality.particlesPerEffect × capacityScale`. */
    capacityScale: number;
}

export abstract class EffectRenderer<K extends EffectKind> extends BaseRenderer<EffectVisualizationConfig> {
    public readonly kind: K;
    /** Nozzle of the effect: meters, local +Z = effect direction. Attached to `body.beamAnchor` once the body is ready. */
    protected readonly effectOrigin = new THREE.Group();
    protected config: EffectVisualizationConfig;
    /** Latest raw DMX values. */
    protected values: Uint8Array = new Uint8Array(0);
    /** State of the previous frame (inside `step`: the state of the current frame), null before the first frame. */
    protected state: EffectStateOf<K> | null = null;

    private readonly defaultOptions: EffectOptionsOf<K>;
    private resolvedOptions: EffectOptionsOf<K>;
    private modelScale = 1;
    private readonly emitters: ManagedEmitter[] = [];
    private lightHandle: LightHandle | null = null;
    private hazeReported = false;

    private readonly worldScale = new THREE.Vector3();
    private readonly lightPosition = new THREE.Vector3();
    private readonly lightColor = new THREE.Color();

    /** @param defaultOptions options used until a config arrives and when the config's options have another kind. */
    protected constructor(inputs: RendererInputs, defaultOptions: EffectOptionsOf<K>) {
        super(inputs);
        this.kind = defaultOptions.kind as K;
        this.defaultOptions = defaultOptions;
        this.resolvedOptions = defaultOptions;
        this.config = { mapping: emptyMapping(), options: defaultOptions };
        this.effectOrigin.name = "effectOrigin";
        // until the body is loaded the effect starts at the object's origin
        this.add(this.effectOrigin);
    }

    /** Effect options of this kind (never another kind's options). */
    protected get options(): EffectOptionsOf<K> {
        return this.resolvedOptions;
    }

    /**
     * Called once per frame after the state is decoded. `this.effectOrigin.matrixWorld` is up to date; call
     * `syncOrigin()` again after moving body parts (e.g. `body.setPanTilt`).
     */
    protected abstract step(state: EffectStateOf<K>, frame: FrameContext): void;

    public override onModelUpdate(modelId: string, modelScale: number): void {
        this.modelScale = modelScale;
        this.body?.setModelScale(modelScale);
        this.loadBody(modelId);
    }

    protected override onBodyReady(body: FixtureBody): void {
        body.setModelScale(this.modelScale);
        body.beamAnchor.add(this.effectOrigin);
        this.add(body);
    }

    /** Subclasses that override this must call `super.onConfigUpdate(c)`. */
    public override onConfigUpdate(c: EffectVisualizationConfig): void {
        this.config = c;
        this.resolvedOptions =
            c.options?.kind === this.kind ? (c.options as EffectOptionsOf<K>) : this.defaultOptions;
    }

    public override onFixtureValueUpdate(v: Uint8Array): void {
        this.values = v ?? new Uint8Array(0);
    }

    /** Resizes the emitters to the quality, decodes the state and calls `step`. Do not override. */
    public override update(frame: FrameContext): void {
        for (const managed of this.emitters) {
            managed.emitter.resize(Math.round(frame.quality.particlesPerEffect * managed.capacityScale));
        }
        this.syncOrigin();
        const state = decodeEffect(
            this.kind,
            this.config.mapping ?? emptyMapping(),
            this.values,
            this.options,
            frame,
            this.state
        ) as EffectStateOf<K>;
        this.state = state;
        this.step(state, frame);
    }

    /** Subclasses that override this must call `super.dispose()`. */
    public override dispose(): void {
        this.removeOmniLight();
        if (this.hazeReported) {
            this.inputs.environment.reportHazeOutput(this.uuid, 0);
            this.hazeReported = false;
        }
        for (const { emitter } of this.emitters) {
            emitter.points.removeFromParent();
            emitter.points.geometry.dispose();
            (emitter.points.material as THREE.Material).dispose();
        }
        this.emitters.length = 0;
        super.dispose();
    }

    /** Keeps the world scale of `effectOrigin` at 1 (meters) and updates its world matrix. */
    protected syncOrigin(): void {
        const origin = this.effectOrigin;
        const parent = origin.parent;
        if (parent) {
            parent.updateWorldMatrix(true, false);
            parent.getWorldScale(this.worldScale);
            const s = this.worldScale;
            origin.scale.set(s.x !== 0 ? 1 / s.x : 1, s.y !== 0 ? 1 / s.y : 1, s.z !== 0 ? 1 / s.z : 1);
        }
        origin.updateMatrixWorld(true);
    }

    /** True while the renderer and all its ancestors are visible (hidden objects should not light the scene). */
    protected isShown(): boolean {
        return isInVisibleHierarchy(this);
    }

    /**
     * Creates a particle emitter whose points live in `effectOrigin` space (meters, +Z = effect direction). The base
     * keeps its capacity at `quality.particlesPerEffect × capacityScale` (resized before `step`) and disposes it.
     * Call it in a field initializer or the constructor.
     */
    protected createEmitter(options: { additive: boolean; capacityScale?: number }): ParticleEmitter {
        const emitter = new ParticleEmitter(0, createParticleMaterial({ additive: options.additive }));
        this.effectOrigin.add(emitter.points);
        this.emitters.push({ emitter, capacityScale: options.capacityScale ?? 1 });
        return emitter;
    }

    /**
     * Sets this effect's single `omni` surface light. `color` is linear RGB at 0..1 brightness (the base applies
     * `OMNI_LIGHT_GAIN`); `localPosition` is in `effectOrigin` space (null = the nozzle); `range` in meters. A null or
     * black color, or a hidden renderer, removes the light.
     */
    protected setOmniLight(color: THREE.Color | null, localPosition: THREE.Vector3 | null, range: number): void {
        if (!color || (color.r <= 0 && color.g <= 0 && color.b <= 0) || !this.isShown()) {
            this.removeOmniLight();
            return;
        }
        if (this.lightHandle === null) {
            this.lightHandle = this.inputs.lighting.addLight();
        }
        const position = this.lightPosition;
        if (localPosition) {
            position.copy(localPosition).applyMatrix4(this.effectOrigin.matrixWorld);
        } else {
            this.effectOrigin.getWorldPosition(position);
        }
        this.inputs.lighting.setLight(this.lightHandle, {
            type: "omni",
            position,
            color: this.lightColor.copy(color).multiplyScalar(OMNI_LIGHT_GAIN),
            range,
        });
    }

    protected removeOmniLight(): void {
        if (this.lightHandle !== null) {
            this.inputs.lighting.removeLight(this.lightHandle);
            this.lightHandle = null;
        }
    }

    /**
     * Reports this renderer's contribution to the hazer coupling (research R13), 0..1; call it every frame (fog). The
     * base reports 0 on dispose.
     */
    protected reportHaze(amount: number): void {
        this.inputs.environment.reportHazeOutput(this.uuid, Math.max(0, amount));
        this.hazeReported = true;
    }
}
