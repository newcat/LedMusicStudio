import * as THREE from "three";

import type { FixtureBody } from "@/assetLibrary/fixtureBody";
import { decodeScalar, readDmx } from "../../capabilities/decode";
import type { LightHandle } from "../../lighting/surfaceLighting";
import { BaseRenderer, RendererInputs } from "../base.renderer";
import type { BeamVisualizationConfig } from "../beam/types";
import { decodeSimpleColor, isInVisibleHierarchy } from "../interimColor";

import VOLUMETRIC_BEAM_VERTEX_SHADER from "./beam.vertex.glsl?raw";
import VOLUMETRIC_BEAM_FRAGMENT_SHADER from "./beam.fragment.glsl?raw";

/** Surface light output factor of the interim spot light (until the beam rewrite, US1). */
const LIGHT_GAIN = 20;
/** Reach of the interim surface light, meters. */
const LIGHT_RANGE = 30;

const BEAM_RESOLUTION = 100;
const BEAM_SEGMENTS = 1;
const BEAM_LENGTH = 100;
/** Used until the body (and with it the model's lens radius) is ready. */
const DEFAULT_LENS_RADIUS = 0.06;
/** Emitter output factor, so a full color blooms. */
const EMITTER_GAIN = 4;

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
 * pan and tilt drive its pan/tilt nodes, and beam and cap hang on its beam anchor (local +Z = beam). Pan, tilt, zoom,
 * dimmer and RGB(W) come from `mapping.channels` through `decodeScalar`; one interim spot light in the view's
 * `SurfaceLighting` lights the surfaces until the beam rewrite (US1).
 */
export class MovingHeadRenderer extends BaseRenderer<BeamVisualizationConfig> {
    private readonly beam;
    private readonly cap;
    private readonly target = new THREE.Object3D();
    private readonly worldPos = new THREE.Vector3();
    private readonly worldTarget = new THREE.Vector3();
    private readonly lightHandle: LightHandle;
    private readonly lightColor = new THREE.Color();
    private readonly color = new THREE.Color();
    private beamMaterial!: THREE.ShaderMaterial;

    private config?: BeamVisualizationConfig;
    private previousValues?: Uint8Array;
    private modelScale = 1;
    private pan = 0;
    private tilt = 0;
    private beamAngle = 15;

    public constructor(inputs: RendererInputs) {
        super(inputs);

        // along the anchor's +Z
        this.target.position.set(0, 0, 10);
        this.lightHandle = inputs.lighting.addLight();

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
        body.beamAnchor.add(this.beam, this.cap, this.target);
        this.add(body);
        this.onFixtureValueUpdate(this.previousValues ?? new Uint8Array(0));
    }

    public onConfigUpdate(c: BeamVisualizationConfig): void {
        this.config = c;
        // if the default values have changed, they will only be applied in onFixtureValueUpdate
        this.onFixtureValueUpdate(this.previousValues ?? new Uint8Array(0));
    }

    public onFixtureValueUpdate(v: Uint8Array): void {
        this.previousValues = v;
        if (!this.config) {
            return;
        }
        const channels = this.config.mapping.channels;
        // values outside every segment keep the previous value (OFL "hold")
        this.pan = decodeScalar(channels.pan, v, this.pan, "pan");
        this.tilt = decodeScalar(channels.tilt, v, this.tilt, "tilt");
        const zoom = channels.zoom;
        this.beamAngle = zoom && readDmx(zoom, v) !== null ? decodeScalar(zoom, v, this.beamAngle, "zoom") : this.config.defaultBeamAngle;
        const { r: red, g: green, b: blue } = decodeSimpleColor(this.config.mapping, v, this.color);

        (this.beamMaterial.uniforms.color.value as THREE.Color).setRGB(red, green, blue);
        this.cap.material.color.setRGB(red, green, blue);
        this.cap.material.emissive.setRGB(red, green, blue);

        this.beamMaterial.uniforms.angle.value = new THREE.Vector3(this.beamAngle, 0, 0);

        // until the body is ready the values are only stored; onBodyReady applies them
        if (this.body) {
            this.body.setPanTilt(this.pan, this.tilt);
            this.body.setEmitterColor("all", red * EMITTER_GAIN, green * EMITTER_GAIN, blue * EMITTER_GAIN);
        }
    }

    public override update(): void {
        const material = this.beamMaterial;
        this.inputs.camera.getWorldPosition(material.uniforms.cameraPos.value as THREE.Vector3);
        this.inputs.camera.getWorldDirection(material.uniforms.cameraDir.value as THREE.Vector3);
        this.cap.getWorldPosition(this.worldPos);
        this.target.getWorldPosition(this.worldTarget);
        (material.uniforms.wpos.value as THREE.Vector3).copy(this.worldPos);
        const direction = (material.uniforms.direction.value as THREE.Vector3).copy(this.worldTarget).sub(this.worldPos).normalize();

        const on = !!this.body && isInVisibleHierarchy(this);
        this.lightColor.copy(this.color).multiplyScalar(on ? LIGHT_GAIN : 0);
        this.inputs.lighting.setLight(this.lightHandle, {
            type: "spot",
            position: this.worldPos,
            direction,
            color: this.lightColor,
            angle: this.beamAngle,
            softness: this.config?.softness ?? 0.25,
            range: LIGHT_RANGE,
            goboTile: -1,
            goboRotation: 0,
            prismFacets: 0,
            prismRotation: 0,
            prismSpread: this.config?.prismSpread ?? 6,
        });
    }

    public override dispose(): void {
        this.beam.removeFromParent();
        this.cap.removeFromParent();
        this.inputs.lighting.removeLight(this.lightHandle);
        this.target.removeFromParent();
        this.beam.geometry.dispose();
        this.beamMaterial.dispose();
        this.cap.geometry.dispose();
        this.cap.material.dispose();
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
