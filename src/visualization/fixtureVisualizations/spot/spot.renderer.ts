import * as THREE from "three";

import type { FixtureBody } from "@/assetLibrary/fixtureBody";
import fragmentShader from "../../shaders/volumetricSpot.frag?raw";
import vertexShader from "../../shaders/volumetricSpot.vert?raw";
import { decodeScalar, readDmx } from "../../capabilities/decode";
import { emptyMapping } from "../../capabilities/types";
import type { LightHandle } from "../../lighting/surfaceLighting";
import { BaseRenderer, RendererInputs } from "../base.renderer";
import { defaultMovement, type BeamVisualizationConfig } from "../beam/types";
import { decodeSimpleColor, isInVisibleHierarchy } from "../interimColor";

const CONE_LENGTH = 15;
const CONE_END_RADIUS = 1.5;
/** Used until the body (and with it the model's lens radius) is ready. */
const DEFAULT_LENS_RADIUS = 0.1;
/** Emitter output factor, so a full color blooms. */
const EMITTER_GAIN = 4;
/** Surface light output factor of the interim spot light (until the beam rewrite, US1). */
const LIGHT_GAIN = 20;
/** Reach of the interim surface light, meters. */
const LIGHT_RANGE = 30;
const PLUS_Z = new THREE.Vector3(0, 0, 1);

/** Open cone that starts at the origin with the lens radius and widens along +Z. */
function createConeGeometry(lensRadius: number): THREE.CylinderGeometry {
    const geometry = new THREE.CylinderGeometry(lensRadius, CONE_END_RADIUS, CONE_LENGTH, 32 * 2, 20, true);
    // narrow end (+Y) at the origin, then turn −Y onto +Z
    geometry.translate(0, -CONE_LENGTH / 2, 0);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
}

/**
 * Spot (feature 002, FR-021): the model body (par can by default) emits along the model's beam direction.
 * The cone hangs on the body's beam anchor. The body itself is pickable, so there is no editor proxy. Zoom, dimmer
 * and RGB(W) come from `mapping.channels` through `decodeScalar`; one interim spot light in the view's
 * `SurfaceLighting` lights the surfaces until the beam rewrite (US1).
 */
export class SpotRenderer extends BaseRenderer<BeamVisualizationConfig> {
    private volumeGeometry: THREE.CylinderGeometry;
    private volumeMesh: THREE.Mesh;
    private volumeMaterial: THREE.ShaderMaterial;
    private readonly lightHandle: LightHandle;
    private readonly color = new THREE.Color();
    private readonly lightColor = new THREE.Color();
    private config: BeamVisualizationConfig = {
        mapping: emptyMapping(),
        movement: defaultMovement(),
        defaultBeamAngle: 15,
        softness: 0.25,
        prismSpread: 6,
    };
    private values: Uint8Array = new Uint8Array(0);
    private modelScale = 1;
    private beamAngle = 15;
    private readonly worldPosition = new THREE.Vector3();
    private readonly worldDirection = new THREE.Vector3();

    constructor(inputs: RendererInputs) {
        super(inputs);

        this.volumeMaterial = new THREE.ShaderMaterial({
            uniforms: {
                attenuation: { value: 4.4 },
                anglePower: { value: 2.6 },
                spotPosition: { value: new THREE.Vector3(0, 0, 0) },
                lightColor: { value: new THREE.Color("white") },
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.FrontSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
        });

        this.volumeGeometry = createConeGeometry(DEFAULT_LENS_RADIUS);
        this.volumeMesh = new THREE.Mesh(this.volumeGeometry, this.volumeMaterial);
        // the beam must not be hit by picking rays (research R8)
        this.volumeMesh.raycast = () => undefined;
        this.volumeMesh.userData.excludeFromBounds = true;

        this.lightHandle = inputs.lighting.addLight();
    }

    public override dispose() {
        this.volumeMesh.removeFromParent();
        this.inputs.lighting.removeLight(this.lightHandle);
        this.volumeGeometry.dispose();
        this.volumeMaterial.dispose();
        super.dispose();
    }

    public override onModelUpdate(modelId: string, modelScale: number): void {
        this.modelScale = modelScale;
        this.body?.setModelScale(modelScale);
        this.loadBody(modelId);
    }

    protected override onBodyReady(body: FixtureBody): void {
        body.setModelScale(this.modelScale);
        const lensRadius = body.definition.fixture.lensRadius;
        if (this.volumeGeometry.parameters.radiusTop !== lensRadius) {
            this.volumeGeometry.dispose();
            this.volumeGeometry = createConeGeometry(lensRadius);
            this.volumeMesh.geometry = this.volumeGeometry;
        }
        body.beamAnchor.add(this.volumeMesh);
        this.add(body);
        this.applyValues();
    }

    public override onConfigUpdate(c: BeamVisualizationConfig) {
        this.config = c;
        this.applyValues();
    }

    public override onFixtureValueUpdate(data: Uint8Array): void {
        this.values = data ?? new Uint8Array(0);
        this.applyValues();
    }

    public override update(): void {
        this.volumeMesh.getWorldPosition(this.worldPosition);
        (this.volumeMaterial.uniforms.spotPosition.value as THREE.Vector3).copy(this.worldPosition);

        // the cone geometry is turned onto +Z, the mesh itself is not: its local +Z is the beam direction
        this.worldDirection.copy(PLUS_Z).transformDirection(this.volumeMesh.matrixWorld);
        const on = !!this.body && isInVisibleHierarchy(this);
        this.lightColor.copy(this.color).multiplyScalar(on ? LIGHT_GAIN : 0);
        this.inputs.lighting.setLight(this.lightHandle, {
            type: "spot",
            position: this.worldPosition,
            direction: this.worldDirection,
            color: this.lightColor,
            angle: this.beamAngle,
            softness: this.config.softness,
            range: LIGHT_RANGE,
            goboTile: -1,
            goboRotation: 0,
            prismFacets: 0,
            prismRotation: 0,
            prismSpread: this.config.prismSpread,
        });
    }

    private applyValues() {
        const data = this.values;
        const mapping = this.config.mapping ?? emptyMapping();
        const zoom = mapping.channels.zoom;
        // values outside every zoom segment keep the previous angle (OFL "hold")
        this.beamAngle = zoom && readDmx(zoom, data) !== null ? decodeScalar(zoom, data, this.beamAngle, "zoom") : this.config.defaultBeamAngle;
        const color = decodeSimpleColor(mapping, data, this.color);
        (this.volumeMaterial.uniforms.lightColor.value as THREE.Color).copy(color);
        this.body?.setEmitterColor("all", color.r * EMITTER_GAIN, color.g * EMITTER_GAIN, color.b * EMITTER_GAIN);
    }
}
