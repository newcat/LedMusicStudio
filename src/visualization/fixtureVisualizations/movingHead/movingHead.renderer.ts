import * as THREE from "three";

import type { FixtureBody } from "@/assetLibrary/fixtureBody";
import { BaseRenderer, RendererInputs } from "../base.renderer";
import { MovingHeadVisualizationConfig } from "./movingHead.visualizationConfig";

import VOLUMETRIC_BEAM_VERTEX_SHADER from "./beam.vertex.glsl?raw";
import VOLUMETRIC_BEAM_FRAGMENT_SHADER from "./beam.fragment.glsl?raw";
import { getChannelValue } from "../channelValue";

const SPOTLIGHT_PHYSICALLY_CORRECT_DISTANCE = 0;
const SPOTLIGHT_PHYSICALLY_CORRECT_INTENSITY = 100.0;
const SPOTLIGHT_PHYSICALLY_CORRECT_DECAY = 1.0;
const SPOTLIGHT_PHYSICALLY_CORRECT_PENUMBRA = 1.2;

const BEAM_RESOLUTION = 100;
const BEAM_SEGMENTS = 1;
const BEAM_LENGTH = 100;
/** Used until the body (and with it the model's lens radius) is ready. */
const DEFAULT_LENS_RADIUS = 0.06;
/** Emitter output factor, so a full color blooms. */
const EMITTER_GAIN = 4;

function degToRad(degAngle: number) {
    return degAngle * (Math.PI / 180);
}

/** Open cylinder whose bottom ring (geometry −Y) has the lens radius; the shader widens the +Y ring. */
function createBeamGeometry(lensRadius: number): THREE.CylinderGeometry {
    const geometry = new THREE.CylinderGeometry(lensRadius, lensRadius, BEAM_LENGTH, BEAM_RESOLUTION, BEAM_SEGMENTS, true);
    const verticesIndexBuffer = [];
    for (let i = 0; i < geometry.attributes.position.count; i++) {
        verticesIndexBuffer[i] = i;
    }
    geometry.setAttribute("index", new THREE.BufferAttribute(new Float32Array(verticesIndexBuffer), 1).setUsage(THREE.StaticDrawUsage));
    return geometry;
}

/**
 * Moving head on top of the fixture model contract (feature 002, research R7): the body comes from the model,
 * pan and tilt drive its pan/tilt nodes, and beam, cap and SpotLight hang on its beam anchor (local +Z = beam).
 */
export class MovingHeadRenderer extends BaseRenderer<MovingHeadVisualizationConfig> {
    private readonly beam;
    private readonly cap;
    private readonly target = new THREE.Object3D();
    private readonly worldPos = new THREE.Vector3();
    private readonly worldTarget = new THREE.Vector3();
    /** Interim real light until the beam rewrite moves it into SurfaceLighting (T035). */
    private readonly spotlight: THREE.SpotLight;
    private beamMaterial!: THREE.ShaderMaterial;

    private config?: MovingHeadVisualizationConfig;
    private previousValues?: Uint8Array;
    private modelScale = 1;

    public constructor(inputs: RendererInputs) {
        super(inputs);

        this.spotlight = new THREE.SpotLight(
            0xffffff,
            SPOTLIGHT_PHYSICALLY_CORRECT_INTENSITY,
            SPOTLIGHT_PHYSICALLY_CORRECT_DISTANCE,
            degToRad(15),
            SPOTLIGHT_PHYSICALLY_CORRECT_PENUMBRA,
            SPOTLIGHT_PHYSICALLY_CORRECT_DECAY
        );
        // along the anchor's +Z
        this.target.position.set(0, 0, 10);
        this.spotlight.target = this.target;

        this.beam = this.getBeam();
        this.cap = this.getCap();
    }

    public override onModelUpdate(modelId: string, modelScale: number): void {
        this.modelScale = modelScale;
        this.body?.setModelScale(modelScale);
        this.loadBody(modelId);
    }

    protected override onBodyReady(body: FixtureBody): void {
        body.setModelScale(this.modelScale);
        const lensRadius = body.definition.fixture.lensRadius;
        this.beamMaterial.uniforms.topRadius.value = lensRadius;
        if (this.beam.geometry.parameters.radiusBottom !== lensRadius) {
            this.beam.geometry.dispose();
            this.beam.geometry = createBeamGeometry(lensRadius);
        }
        this.cap.scale.setScalar(lensRadius / DEFAULT_LENS_RADIUS);
        body.beamAnchor.add(this.beam, this.cap, this.spotlight, this.target);
        this.add(body);
        this.onFixtureValueUpdate(this.previousValues ?? new Uint8Array(0));
    }

    public onConfigUpdate(c: MovingHeadVisualizationConfig): void {
        this.config = c;
        // if the default values have changed, they will only be applied in onFixtureValueUpdate
        this.onFixtureValueUpdate(this.previousValues ?? new Uint8Array(0));
    }

    public onFixtureValueUpdate(v: Uint8Array): void {
        this.previousValues = v;
        if (!this.config) {
            return;
        }
        const pan = getChannelValue(this.config.channelMapping.pan, v);
        const tilt = getChannelValue(this.config.channelMapping.tilt, v);
        const beamAngle = getChannelValue(this.config.channelMapping.beamAngle, v);
        const red = getChannelValue(this.config.channelMapping.red, v) / 255;
        const green = getChannelValue(this.config.channelMapping.green, v) / 255;
        const blue = getChannelValue(this.config.channelMapping.blue, v) / 255;

        this.spotlight.color.setRGB(red, green, blue);
        (this.beamMaterial.uniforms.color.value as THREE.Color).setRGB(red, green, blue);
        this.cap.material.color.setRGB(red, green, blue);
        this.cap.material.emissive.setRGB(red, green, blue);

        this.spotlight.angle = degToRad(beamAngle);
        this.beamMaterial.uniforms.angle.value = new THREE.Vector3(beamAngle, 0, 0);

        // until the body is ready the values are only stored; onBodyReady applies them
        if (this.body) {
            this.body.setPanTilt(pan, tilt);
            this.body.setEmitterColor("all", red * EMITTER_GAIN, green * EMITTER_GAIN, blue * EMITTER_GAIN);
        }
    }

    public override update(): void {
        const material = this.beamMaterial;
        this.inputs.camera.getWorldPosition(material.uniforms.cameraPos.value as THREE.Vector3);
        this.inputs.camera.getWorldDirection(material.uniforms.cameraDir.value as THREE.Vector3);
        this.spotlight.getWorldPosition(this.worldPos);
        this.target.getWorldPosition(this.worldTarget);
        (material.uniforms.wpos.value as THREE.Vector3).copy(this.worldPos);
        (material.uniforms.direction.value as THREE.Vector3).copy(this.worldTarget).sub(this.worldPos).normalize();
    }

    public override dispose(): void {
        this.beam.removeFromParent();
        this.cap.removeFromParent();
        this.spotlight.removeFromParent();
        this.target.removeFromParent();
        this.beam.geometry.dispose();
        this.beamMaterial.dispose();
        this.cap.geometry.dispose();
        this.cap.material.dispose();
        this.spotlight.dispose();
        super.dispose();
    }

    private getBeam() {
        const beamLength = BEAM_LENGTH;
        const beamGeometry = createBeamGeometry(DEFAULT_LENS_RADIUS);

        const cameraDir = new THREE.Vector3();
        const cameraPos = new THREE.Vector3();
        if (this.inputs.camera) {
            this.inputs.camera.getWorldDirection(cameraDir);
            this.inputs.camera.getWorldPosition(cameraPos);
        }

        this.beamMaterial = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            clipping: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            vertexShader: VOLUMETRIC_BEAM_VERTEX_SHADER,
            fragmentShader: VOLUMETRIC_BEAM_FRAGMENT_SHADER,
            fog: false,
            toneMapped: false,
            dithering: false,
            uniforms: {
                cameraDir: {
                    value: cameraDir,
                },
                cameraPos: {
                    value: cameraPos,
                },
                vertexCount: {
                    value: beamGeometry.attributes.position.count,
                },
                topRadius: {
                    value: DEFAULT_LENS_RADIUS,
                },
                len: {
                    value: beamLength,
                },
                color: {
                    value: new THREE.Color(0xffffff),
                },
                intensity: {
                    value: 1.0,
                },
                wpos: {
                    value: this.target.getWorldDirection(new THREE.Vector3()).normalize(),
                },
                direction: {
                    value: this.target.getWorldDirection(new THREE.Vector3()).normalize(),
                },
                angle: {
                    value: new THREE.Vector3(15.0, 1.0, 0.0),
                },
                time: {
                    value: 0.0,
                },
                fogState: {
                    value: true,
                },
                fogFactor: {
                    value: 1.0,
                },
                fogTurbulence: {
                    value: 1.0,
                },
                glowFactor: {
                    value: 1.0,
                },
            },
        });

        const beamMesh = new THREE.Mesh(beamGeometry, this.beamMaterial);
        // the beam must not be hit by picking rays (research R8)
        beamMesh.raycast = () => undefined;
        beamMesh.userData.excludeFromBounds = true;

        // The shader widens the cylinder in its geometry space (+Y end), so the geometry stays untouched and the mesh
        // is turned instead: +90 degrees about X puts the cylinder axis on the anchor's +Z, starting at the lens.
        beamMesh.rotation.x = Math.PI / 2;
        beamMesh.position.z = beamGeometry.parameters.height / 2;

        return beamMesh;
    }

    private getCap() {
        // at the anchor origin, facing +Z (the beam direction); scaled to the model's lens radius in onBodyReady
        const capGeometry = new THREE.CircleGeometry(DEFAULT_LENS_RADIUS, 40);
        const capMaterial = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            emissive: 0xffffff,
            emissiveIntensity: 10.0,
        });


        const capMesh = new THREE.Mesh(capGeometry, capMaterial);
        return capMesh;
    }
}
