import * as THREE from "three";

import type { FixtureBody } from "@/assetLibrary/fixtureBody";
import { decodeCells } from "../../capabilities/cellState";
import { ADDITIVE_PRIMARIES, hexToLinear, kelvinToRgb } from "../../capabilities/colorMath";
import { decodeScalar, findSegment, readDmx } from "../../capabilities/decode";
import { ShutterGate } from "../../capabilities/strobe";
import { emptyMapping } from "../../capabilities/types";
import type { CapabilityChannel, CapabilityKey, CapabilitySegment } from "../../capabilities/types";
import type { LightHandle } from "../../lighting/surfaceLighting";
import { BaseRenderer, type FrameContext } from "../base.renderer";
import { isInVisibleHierarchy } from "../visibility";
import type { GenericVisualizationConfig } from "./types";

/** Emitter output factor, so full output blooms. */
const EMITTER_GAIN = 4;
/** Strobes and blinders flash so brightly that they "light up the scene" (T069). */
const FLASH_FIXTURE_GAIN = 8;
const FLASH_FIXTURE_MODELS = new Set(["fixture.strobe", "fixture.blinder"]);
/** Surface light output factor: compensates the `1 / (1 + d²)` falloff of the surface lighting (as the beam renderer). */
const LIGHT_GAIN = 20;
const LIGHT_SOFTNESS = 0.8;
/** Meters. */
const LIGHT_RANGE = 15;
const PLUS_Z = new THREE.Vector3(0, 0, 1);

const ADDITIVE_KEYS = [
    "red",
    "green",
    "blue",
    "white",
    "amber",
    "uv",
    "lime",
    "indigo",
    "warmWhite",
    "coldWhite",
] as const satisfies ReadonlyArray<keyof typeof ADDITIVE_PRIMARIES & CapabilityKey>;

function isMapped(entry: CapabilityChannel | undefined, values: Uint8Array): entry is CapabilityChannel {
    return !!entry && readDmx(entry, values) !== null;
}

function clamp01(v: number): number {
    return Math.min(1, Math.max(0, v));
}

/**
 * Generic Fixture (feature 003, FR-034, research R14): the model body with its emitters. Each frame the fixture color
 * (additive mix, white when no color key is mapped; color temperature and color macro), the dimmer (default 1) and
 * the shutter gate (default open) are decoded, then the cells are spread over the model's `cell-*` emitters
 * (`decodeCells`). With `config.surfaceLight` one wide spot light from the beam anchor (the model root facing +Y
 * when the model has no beam) lights the surfaces with the average color.
 */
export class GenericRenderer extends BaseRenderer<GenericVisualizationConfig> {
    private config: GenericVisualizationConfig = { mapping: emptyMapping(), surfaceLight: false, lightAngle: 90 };
    private values: Uint8Array = new Uint8Array(0);
    private modelScale = 1;
    private emitterGain = EMITTER_GAIN;

    private readonly gate = new ShutterGate();
    private shutterSegment: CapabilitySegment | null = null;
    private macroSegment: CapabilitySegment | null = null;
    private readonly held = new Map<CapabilityKey, number>();
    private lightHandle: LightHandle | null = null;

    private readonly fixtureColor = new THREE.Color();
    private readonly tmp = new THREE.Color();
    private readonly lightColor = new THREE.Color();
    private readonly worldPosition = new THREE.Vector3();
    private readonly worldDirection = new THREE.Vector3();

    public override onModelUpdate(modelId: string, modelScale: number): void {
        this.modelScale = modelScale;
        this.emitterGain = FLASH_FIXTURE_MODELS.has(modelId) ? FLASH_FIXTURE_GAIN : EMITTER_GAIN;
        this.body?.setModelScale(modelScale);
        this.loadBody(modelId);
    }

    public onConfigUpdate(c: GenericVisualizationConfig): void {
        this.config = c;
        if (c.surfaceLight && this.lightHandle === null) {
            this.lightHandle = this.inputs.lighting.addLight();
        } else if (!c.surfaceLight && this.lightHandle !== null) {
            this.inputs.lighting.removeLight(this.lightHandle);
            this.lightHandle = null;
        }
    }

    public onFixtureValueUpdate(values: Uint8Array): void {
        this.values = values ?? new Uint8Array(0);
    }

    protected override onBodyReady(body: FixtureBody): void {
        body.setModelScale(this.modelScale);
        this.add(body);
    }

    public override update(frame: FrameContext): void {
        const mapping = this.config.mapping ?? emptyMapping();
        const values = this.values;
        const ch = mapping.channels;

        const color = this.decodeFixtureColor(values);
        const dimmer = clamp01(this.scalar("dimmer", ch.dimmer, values, 1));
        const intensity = dimmer * this.shutter(ch.shutter, values, frame);

        const body = this.body;
        const cells = decodeCells(mapping, values, body?.emitterIds ?? [], color, intensity);

        if (body) {
            if (mapping.cells.length > 0) {
                const colors = cells.colors;
                for (let i = 0; i < colors.length; i++) {
                    colors[i] *= this.emitterGain;
                }
                body.setCellColors(colors);
            } else {
                const a = cells.average;
                body.setEmitterColor("all", a.r * this.emitterGain, a.g * this.emitterGain, a.b * this.emitterGain);
            }
        }

        if (this.lightHandle !== null) {
            const on = !!body && intensity > 0 && isInVisibleHierarchy(this);
            if (body) {
                const anchor = body.beamAnchor;
                anchor.getWorldPosition(this.worldPosition);
                this.worldDirection.copy(PLUS_Z).transformDirection(anchor.matrixWorld);
            } else {
                this.getWorldPosition(this.worldPosition);
                this.worldDirection.set(0, 1, 0);
            }
            this.lightColor.copy(cells.average).multiplyScalar(on ? LIGHT_GAIN : 0);
            this.inputs.lighting.setLight(this.lightHandle, {
                type: "spot",
                position: this.worldPosition,
                direction: this.worldDirection,
                color: this.lightColor,
                angle: this.config.lightAngle,
                softness: LIGHT_SOFTNESS,
                range: LIGHT_RANGE,
                goboTile: -1,
                goboRotation: 0,
                prismFacets: 0,
                prismRotation: 0,
                prismSpread: 0,
            });
        }
    }

    public override dispose(): void {
        if (this.lightHandle !== null) {
            this.inputs.lighting.removeLight(this.lightHandle);
            this.lightHandle = null;
        }
        super.dispose();
    }

    /** Linear RGB of the fixture-wide color keys (before intensity); white when no color key is mapped. */
    private decodeFixtureColor(values: Uint8Array): THREE.Color {
        const ch = this.config.mapping.channels;
        const color = this.fixtureColor.setRGB(0, 0, 0, THREE.LinearSRGBColorSpace);
        let anyAdditive = false;
        for (const key of ADDITIVE_KEYS) {
            const entry = ch[key];
            if (!isMapped(entry, values)) {
                continue;
            }
            anyAdditive = true;
            const v = Math.max(0, this.scalar(key, entry, values, 0));
            const p = ADDITIVE_PRIMARIES[key];
            color.r += p.r * v;
            color.g += p.g * v;
            color.b += p.b * v;
        }
        if (!anyAdditive) {
            color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
        }

        if (isMapped(ch.colorTemperature, values)) {
            color.multiply(kelvinToRgb(this.scalar("colorTemperature", ch.colorTemperature, values, 6500), this.tmp));
        }

        // A color macro replaces the mix; a split macro shows the average of its two colors.
        if (isMapped(ch.colorMacro, values)) {
            const segment = findSegment(ch.colorMacro, readDmx(ch.colorMacro, values)!);
            if (segment) {
                this.macroSegment = segment;
            }
            const macro = this.macroSegment;
            if (macro?.kind === "color") {
                if (macro.colors.length > 0) {
                    hexToLinear(macro.colors[0], color);
                    if (macro.colors.length > 1) {
                        color.add(hexToLinear(macro.colors[1], this.tmp)).multiplyScalar(0.5);
                    }
                } else if (macro.temperature !== null) {
                    kelvinToRgb(macro.temperature, color);
                }
            }
        } else {
            this.macroSegment = null;
        }
        return color;
    }

    /** decodeScalar with hold: unmatched raws keep the previous value of the key. */
    private scalar(key: CapabilityKey, entry: CapabilityChannel | undefined, values: Uint8Array, initial: number): number {
        const prev = this.held.get(key) ?? (entry && entry.channel < 0 ? entry.defaultValue : initial);
        const v = decodeScalar(entry, values, prev, key);
        this.held.set(key, v);
        return v;
    }

    /** Shutter/strobe gate 0..1; open when no shutter is mapped. */
    private shutter(entry: CapabilityChannel | undefined, values: Uint8Array, frame: FrameContext): number {
        if (!entry) {
            return this.gate.update(null, 0, frame);
        }
        const raw = readDmx(entry, values);
        if (raw === null) {
            this.gate.update(null, 0, frame);
            return clamp01(entry.defaultValue);
        }
        if (entry.segments.length === 0) {
            return this.gate.update(null, 0, frame);
        }
        const segment = findSegment(entry, raw);
        if (segment) {
            this.shutterSegment = segment;
        }
        const held = this.shutterSegment;
        // ShutterGate expects the raw value in 8-bit segment units.
        const segmentRaw = entry.fine >= 0 ? raw / 257 : raw;
        return this.gate.update(held?.kind === "shutter" ? held : null, segmentRaw, frame);
    }
}
