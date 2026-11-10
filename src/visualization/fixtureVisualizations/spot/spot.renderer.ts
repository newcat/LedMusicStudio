import * as THREE from "three";

import type { FixtureBody } from "@/assetLibrary/fixtureBody";
import fragmentShader from "../../shaders/volumetricSpot.frag?raw";
import vertexShader from "../../shaders/volumetricSpot.vert?raw";
import { BaseRenderer, RendererInputs } from "../base.renderer";
import { SpotVisualizationConfig } from "./types";

const CONE_LENGTH = 15;
const CONE_END_RADIUS = 1.5;
/** Used until the body (and with it the model's lens radius) is ready. */
const DEFAULT_LENS_RADIUS = 0.1;
/** Emitter output factor, so a full color blooms. */
const EMITTER_GAIN = 4;

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
 * Cone and SpotLight hang on the body's beam anchor. The body itself is pickable, so there is no editor proxy.
 */
export class SpotRenderer extends BaseRenderer<SpotVisualizationConfig> {
    private volumeGeometry: THREE.CylinderGeometry;
    private volumeMesh: THREE.Mesh;
    private volumeMaterial: THREE.ShaderMaterial;
    /** Interim real light until the beam rewrite moves it into SurfaceLighting (T035). */
    private spotlight: THREE.SpotLight;
    private spotlightTarget: THREE.Object3D;
    private config: SpotVisualizationConfig = { colorChannels: [-1, -1, -1, -1] };
    private values: Uint8Array = new Uint8Array(0);
    private modelScale = 1;
    private readonly worldPosition = new THREE.Vector3();

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

        this.spotlightTarget = new THREE.Object3D();
        this.spotlightTarget.position.set(0, 0, 1);
        this.spotlight = new THREE.SpotLight(0xffffff, 1, 100, Math.PI / 22, 0.5, 1);
        this.spotlight.target = this.spotlightTarget;
    }

    public override dispose() {
        this.volumeMesh.removeFromParent();
        this.spotlight.removeFromParent();
        this.spotlightTarget.removeFromParent();
        this.volumeGeometry.dispose();
        this.volumeMaterial.dispose();
        this.spotlight.dispose();
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
        body.beamAnchor.add(this.volumeMesh, this.spotlight, this.spotlightTarget);
        this.add(body);
        this.applyValues();
    }

    public override onConfigUpdate(c: SpotVisualizationConfig) {
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
    }

    private applyValues() {
        const data = this.values;
        const [redChannel, greenChannel, blueChannel, whiteChannel] = this.config.colorChannels;
        const red = redChannel >= 0 ? data[redChannel] ?? 0 : 0;
        const green = greenChannel >= 0 ? data[greenChannel] ?? 0 : 0;
        const blue = blueChannel >= 0 ? data[blueChannel] ?? 0 : 0;
        const white = whiteChannel >= 0 ? data[whiteChannel] ?? 0 : 0;
        const color = new THREE.Color(red / 255, green / 255, blue / 255);
        color.addScalar(white / 255);
        this.volumeMaterial.uniforms.lightColor.value = color;
        this.spotlight.color = color;
        this.body?.setEmitterColor("all", color.r * EMITTER_GAIN, color.g * EMITTER_GAIN, color.b * EMITTER_GAIN);
    }
}
