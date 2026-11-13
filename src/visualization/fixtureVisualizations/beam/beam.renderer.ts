import * as THREE from "three";

import type { FixtureBody } from "@/assetLibrary/fixtureBody";
import { BeamDecoder } from "../../capabilities/beamState";
import { readDmx } from "../../capabilities/decode";
import { KEY_INFO } from "../../capabilities/keys";
import { AxisFollower } from "../../capabilities/movement";
import { emptyMapping } from "../../capabilities/types";
import type { CapabilityChannel } from "../../capabilities/types";
import { NO_SHADOW_LAYER } from "../../layers";
import type { LightHandle } from "../../lighting/surfaceLighting";
import { BaseRenderer, type FrameContext, type RendererInputs } from "../base.renderer";
import { isInVisibleHierarchy } from "../interimColor";
import { createBeamGeometry, createBeamMaterial, MAX_PRISM_FACETS, setBeamFacets, type BeamMaterial } from "./beamMaterial";
import { defaultMovement, type BeamVisualizationConfig } from "./types";

/** Farthest beam length in meters: the center ray's raycast distance when nothing is hit (research R11). */
const MAX_BEAM_LENGTH = 100;
/** The surface light reaches this far beyond the first hit, meters. */
const LIGHT_RANGE_MARGIN = 2;
/** Used until the body (and with it the model's lens radius) is ready. */
const DEFAULT_LENS_RADIUS = 0.06;
/** Emitter output factor, so a full color blooms. */
const EMITTER_GAIN = 4;
/** Surface light output factor: compensates the `1 / (1 + d²)` falloff of the surface lighting. */
const LIGHT_GAIN = 20;
/** Zoom moves through its full range in about this many seconds (research R6). */
const ZOOM_FULL_RANGE_SECONDS = 0.3;
/** panTiltSpeed at 255 slows the movement to this share of the configured speed (data-model §1). */
const SLOWEST_SPEED_FACTOR = 0.1;
const PLUS_Z = new THREE.Vector3(0, 0, 1);

interface GoboSlot {
    image: string | null;
    tile: number;
}

/** Linear range covered by the zoom channel's segments (or the key's default range), degrees. */
function zoomRange(entry: CapabilityChannel | undefined): number {
    let min = Infinity;
    let max = -Infinity;
    for (const segment of entry?.segments ?? []) {
        if (segment.kind === "linear") {
            min = Math.min(min, segment.start, segment.end);
            max = Math.max(max, segment.start, segment.end);
        }
    }
    if (max > min) {
        return max - min;
    }
    const [start, end] = KEY_INFO.zoom.defaultRange ?? [10, 45];
    return Math.max(1, Math.abs(end - start));
}

/**
 * Spot and moving head (feature 003, research R4): the model body emits along its beam anchor (local +Z). Each frame
 * the raw values are decoded into a `BeamState`, pan/tilt/zoom follow it with realistic movement (R6), and the beam
 * cone, the lens emitter and one spot light in the view's `SurfaceLighting` show it. The body itself is pickable,
 * so there is no editor proxy.
 */
export class BeamRenderer extends BaseRenderer<BeamVisualizationConfig> {
    private readonly decoder = new BeamDecoder();
    private readonly panFollower = new AxisFollower(600);
    private readonly tiltFollower = new AxisFollower(400);
    private readonly zoomFollower = new AxisFollower(100);
    private readonly lightHandle: LightHandle;
    private readonly beamMaterial: BeamMaterial;
    private beamGeometry: THREE.InstancedBufferGeometry;
    private beamRadialSegments: number;
    private readonly beam: THREE.Mesh;
    private readonly cap: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
    private readonly gobos: [GoboSlot, GoboSlot] = [
        { image: null, tile: -1 },
        { image: null, tile: -1 },
    ];

    private config: BeamVisualizationConfig = {
        mapping: emptyMapping(),
        movement: defaultMovement(),
        defaultBeamAngle: 15,
        softness: 0.25,
        prismSpread: 6,
    };
    private values: Uint8Array = new Uint8Array(0);
    private modelScale = 1;
    private zoomSpeed = 100;
    /** Followers snap onto their first target instead of sweeping from 0. */
    private initialized = false;

    private readonly worldPosition = new THREE.Vector3();
    private readonly worldDirection = new THREE.Vector3();
    private readonly worldScale = new THREE.Vector3();
    private readonly mixColor = new THREE.Color();
    private readonly lightColor = new THREE.Color();

    /** Center-ray raycast cache (research R11): redone only when the anchor moved or the targets changed. */
    private readonly raycaster = new THREE.Raycaster();
    private readonly hits: THREE.Intersection[] = [];
    private readonly rayAnchorMatrix = new THREE.Matrix4();
    private rayTargetsVersion = -1;
    private rayValid = false;
    /** World distance from the lens to the first hit (MAX_BEAM_LENGTH without a hit), and the hit point. */
    private hitDistance = MAX_BEAM_LENGTH;
    private readonly hitPoint = new THREE.Vector3();

    public constructor(inputs: RendererInputs) {
        super(inputs);
        this.lightHandle = inputs.lighting.addLight();
        this.raycaster.far = MAX_BEAM_LENGTH;

        this.beamMaterial = createBeamMaterial(inputs.lighting.gobos.texture, inputs.lighting.shadowAtlasTexture);
        this.beamMaterial.uniforms.topRadius.value = DEFAULT_LENS_RADIUS;
        this.beamRadialSegments = 48;
        this.beamGeometry = createBeamGeometry(this.beamRadialSegments, MAX_PRISM_FACETS);
        setBeamFacets(this.beamGeometry, 0);
        this.beam = new THREE.Mesh(this.beamGeometry, this.beamMaterial);
        // the beam must not be hit by picking rays nor count for the bounds (research R8)
        this.beam.raycast = () => undefined;
        this.beam.userData.excludeFromBounds = true;
        // the shader displaces the vertices; the geometry's bounding sphere is infinite anyway
        this.beam.frustumCulled = false;
        // beams never cast shadows (research R11)
        this.beam.layers.set(NO_SHADOW_LAYER);
        // the shadow tile is assigned in SurfaceLighting.update, after this renderer's update: read it when drawing
        this.beam.onBeforeRender = () => this.applyShadowTile();

        // at the anchor origin, facing +Z (the beam direction); scaled to the model's lens radius in onBodyReady
        this.cap = new THREE.Mesh(
            new THREE.CircleGeometry(DEFAULT_LENS_RADIUS, 40),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: 0x000000, toneMapped: false })
        );
        this.cap.layers.set(NO_SHADOW_LAYER);
    }

    public override onModelUpdate(modelId: string, modelScale: number): void {
        this.modelScale = modelScale;
        this.body?.setModelScale(modelScale);
        this.loadBody(modelId);
    }

    protected override onBodyReady(body: FixtureBody): void {
        body.setModelScale(this.modelScale);
        const lensRadius = body.definition.fixture.lensRadius;
        // the anchor sits inside the body's scale group: the lens radius is in model units there
        this.beamMaterial.uniforms.topRadius.value = lensRadius;
        this.cap.scale.setScalar(lensRadius / DEFAULT_LENS_RADIUS);
        body.beamAnchor.add(this.beam, this.cap);
        this.add(body);
    }

    public override onConfigUpdate(c: BeamVisualizationConfig): void {
        this.config = c;
        this.zoomSpeed = zoomRange(c.mapping.channels.zoom) / ZOOM_FULL_RANGE_SECONDS;
    }

    public override onFixtureValueUpdate(v: Uint8Array): void {
        this.values = v ?? new Uint8Array(0);
    }

    public override update(frame: FrameContext): void {
        const config = this.config;
        const state = this.decoder.decode(config.mapping, this.values, frame, config);
        const instant = config.movement.mode === "instant" || !this.initialized;
        this.initialized = true;

        // 1. Movement: pan/tilt (speed scaled by panTiltSpeed when mapped) and zoom.
        const speedFactor = this.speedFactor();
        this.panFollower.setMaxSpeed(config.movement.panSpeed * speedFactor);
        this.tiltFollower.setMaxSpeed(config.movement.tiltSpeed * speedFactor);
        this.zoomFollower.setMaxSpeed(this.zoomSpeed);
        const pan = this.follow(this.panFollower, state.pan, instant, frame.dt);
        const tilt = this.follow(this.tiltFollower, state.tilt, instant, frame.dt);
        const angle = Math.max(0.1, this.follow(this.zoomFollower, state.beamAngle, instant, frame.dt));

        // 2. Gobo tiles (the nearer of the two slots while the wheel is between them).
        const currentTile = this.syncGobo(this.gobos[0], state.gobo);
        const nextTile = this.syncGobo(this.gobos[1], state.goboNext);
        const goboTile = state.goboNext !== null && state.goboBlend > 0.5 ? nextTile : state.goboBlend > 0.5 ? -1 : currentTile;

        // 3. Color: the surface light and the lens show the 50/50 average of a split color.
        const intensity = state.intensity;
        const mix = this.mixColor.copy(state.color);
        if (state.splitColor) {
            mix.add(state.splitColor).multiplyScalar(0.5);
        }

        const body = this.body;
        const on = !!body && intensity > 0 && isInVisibleHierarchy(this);
        if (body) {
            if (body.panNode || body.tiltNode) {
                body.setPanTilt(pan, tilt);
                // the view updated the world matrices before this call; the anchor must follow the new pose now
                body.updateWorldMatrix(false, true);
            }
            const e = intensity * EMITTER_GAIN;
            body.setEmitterColor("all", mix.r * e, mix.g * e, mix.b * e);
            this.cap.material.color.setRGB(mix.r * e, mix.g * e, mix.b * e);
        }

        // 4. Beam cone.
        if (frame.quality.beamRadialSegments !== this.beamRadialSegments) {
            this.rebuildBeamGeometry(frame.quality.beamRadialSegments);
        }
        this.beam.visible = on;
        const u = this.beamMaterial.uniforms;
        const facets = state.prismFacets >= 3 ? Math.min(MAX_PRISM_FACETS, Math.floor(state.prismFacets)) : 0;
        if (body) {
            const anchor = body.beamAnchor;
            anchor.getWorldPosition(this.worldPosition);
            this.worldDirection.copy(PLUS_Z).transformDirection(anchor.matrixWorld);
            this.worldScale.setFromMatrixScale(anchor.matrixWorld);
            if (on) {
                this.updateCenterRay(anchor);
            }
            u.uLength.value = this.hitDistance / Math.max(1e-6, this.worldScale.z);
        }
        u.color.value.copy(state.color);
        u.uIntensity.value = intensity;
        u.angle.value = angle;
        u.time.value = frame.time;
        u.uHaze.value = frame.haze;
        u.uHazeOctaves.value = frame.quality.hazeOctaves;
        u.uGoboTile.value = goboTile;
        u.uGoboRotation.value = state.goboRotation;
        u.uHasSplit.value = state.splitColor !== null;
        if (state.splitColor) {
            u.uSplitColor.value.copy(state.splitColor);
        }
        u.uFacets.value = facets;
        u.uPrismSpread.value = config.prismSpread;
        u.uPrismRotation.value = state.prismRotation;
        setBeamFacets(this.beamGeometry, facets);

        // 5. Surface light.
        this.lightColor.copy(mix).multiplyScalar(on ? intensity * LIGHT_GAIN : 0);
        this.inputs.lighting.setLight(this.lightHandle, {
            type: "spot",
            position: this.worldPosition,
            direction: this.worldDirection,
            color: this.lightColor,
            angle,
            softness: state.softness,
            range: this.hitDistance + LIGHT_RANGE_MARGIN,
            litPoint: this.hitPoint,
            goboTile,
            goboRotation: state.goboRotation,
            prismFacets: facets,
            prismRotation: state.prismRotation,
            prismSpread: config.prismSpread,
        });
    }

    public override dispose(): void {
        this.beam.removeFromParent();
        this.cap.removeFromParent();
        this.inputs.lighting.removeLight(this.lightHandle);
        for (const slot of this.gobos) {
            this.syncGobo(slot, null);
        }
        this.beamGeometry.dispose();
        this.beamMaterial.dispose();
        this.cap.geometry.dispose();
        this.cap.material.dispose();
        super.dispose();
    }

    /** 1 = configured speed; a mapped panTiltSpeed channel scales it down to 10 % at 255. */
    private speedFactor(): number {
        const entry = this.config.mapping.channels.panTiltSpeed;
        const raw = entry ? readDmx(entry, this.values) : null;
        if (!entry || raw === null) {
            return 1;
        }
        const t = raw / (entry.fine >= 0 ? 65535 : 255);
        return 1 - (1 - SLOWEST_SPEED_FACTOR) * Math.min(1, Math.max(0, t));
    }

    private follow(follower: AxisFollower, target: number, instant: boolean, dt: number): number {
        if (instant) {
            follower.snap(target);
            return target;
        }
        follower.setTarget(target);
        return follower.update(dt);
    }

    /** Keeps the slot's atlas tile on `image`; the new tile is acquired before the old one is released. */
    private syncGobo(slot: GoboSlot, image: string | null): number {
        if (slot.image === image) {
            return slot.tile;
        }
        const tile = image !== null ? this.inputs.lighting.gobos.acquire(image) : -1;
        if (slot.tile >= 0) {
            this.inputs.lighting.gobos.release(slot.tile);
        }
        slot.image = image;
        slot.tile = tile;
        return tile;
    }

    /**
     * Beam length from the center ray (research R11): at most one raycast per frame against the view's static
     * meshes, and only when the anchor's world matrix or the raycast targets changed since the last one.
     */
    private updateCenterRay(anchor: THREE.Object3D) {
        const version = this.inputs.raycastTargetsVersion();
        if (this.rayValid && version === this.rayTargetsVersion && this.rayAnchorMatrix.equals(anchor.matrixWorld)) {
            return;
        }
        this.rayValid = true;
        this.rayTargetsVersion = version;
        this.rayAnchorMatrix.copy(anchor.matrixWorld);

        this.raycaster.set(this.worldPosition, this.worldDirection);
        this.hits.length = 0;
        this.raycaster.intersectObjects(this.inputs.raycastTargets() as THREE.Object3D[], false, this.hits);
        const hit = this.hits[0];
        this.hitDistance = hit ? Math.max(hit.distance, 1e-3) : MAX_BEAM_LENGTH;
        this.hitPoint.copy(this.worldDirection).multiplyScalar(this.hitDistance).add(this.worldPosition);
        this.hits.length = 0;
    }

    /** Called right before the beam is drawn: the shadow tile of this frame cuts the beam off (quality "high"). */
    private applyShadowTile() {
        const u = this.beamMaterial.uniforms;
        const lighting = this.inputs.lighting;
        u.uShadowAtlas.value = lighting.shadowAtlasTexture;
        const shadow = lighting.getShadowTile(this.lightHandle);
        if (shadow) {
            u.uShadowTile.value = shadow.tile;
            u.uShadowMatrix.value.copy(shadow.matrix);
        } else {
            u.uShadowTile.value = -1;
        }
    }

    private rebuildBeamGeometry(radialSegments: number) {
        this.beamRadialSegments = radialSegments;
        this.beamGeometry.dispose();
        this.beamGeometry = createBeamGeometry(radialSegments, MAX_PRISM_FACETS);
        this.beam.geometry = this.beamGeometry;
    }
}
