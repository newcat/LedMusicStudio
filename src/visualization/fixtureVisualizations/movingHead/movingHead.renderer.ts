import * as THREE from "three";

import { modelLibrary } from "../../modelLibrary";
import { BaseRenderer, RendererInputs } from "../base.renderer";
import { MovingHeadVisualizationConfig } from "./types";

import VOLUMETRIC_BEAM_VERTEX_SHADER from "./beam.vertex.glsl?raw";
import VOLUMETRIC_BEAM_FRAGMENT_SHADER from "./beam.fragment.glsl?raw";

const SPOTLIGHT_PHYSICALLY_CORRECT_DISTANCE = 0;
const SPOTLIGHT_PHYSICALLY_CORRECT_INTENSITY = 100.0;
const SPOTLIGHT_PHYSICALLY_CORRECT_DECAY = 1.0;
const SPOTLIGHT_PHYSICALLY_CORRECT_PENUMBRA = 1.2;

const BEAM_RESOLUTION = 100;
const BEAM_SEGMENTS = 1;
const BEAM_LENGTH = 100;
const BEAM_TOP_RADIUS = 0.09;
const BEAM_MAX_ANGLE = 45;

export class MovingHeadRenderer extends BaseRenderer<MovingHeadVisualizationConfig, number[]> {
    private readonly base: THREE.Object3D;
    private readonly head: THREE.Object3D;
    private readonly yoke: THREE.Object3D;
    private readonly beam;
    private readonly cap;
    private readonly target = new THREE.Object3D();
    private readonly spotlight: THREE.SpotLight;

    public constructor(inputs: RendererInputs) {
        super(inputs);

        const model = modelLibrary.getModel("MovingHead");
        this.base = model.children[0].clone();
        this.head = model.children[1].clone();
        this.yoke = model.children[2].clone();

        this.spotlight = new THREE.SpotLight(
            0xffffff,
            SPOTLIGHT_PHYSICALLY_CORRECT_INTENSITY,
            SPOTLIGHT_PHYSICALLY_CORRECT_DISTANCE,
            Math.PI / 22,
            SPOTLIGHT_PHYSICALLY_CORRECT_PENUMBRA,
            SPOTLIGHT_PHYSICALLY_CORRECT_DECAY
        );
        this.spotlight.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
        this.spotlight.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, 0.9));

        this.beam = this.getBeam();
        this.cap = this.getCap();

        this.base.attach(this.yoke);
        this.yoke.attach(this.head);
        this.head.attach(this.beam);
        this.beam.attach(this.target);
        this.beam.attach(this.spotlight);
        this.spotlight.target = this.target;
        this.add(this.base, this.cap);
    }

    public onConfigUpdate(c: MovingHeadVisualizationConfig): void {
        // TODO
    }

    public onFixtureValueUpdate(v: number[]): void {
        // TODO
    }

    private getBeam() {
        const beamGeometry = new THREE.CylinderGeometry(
            BEAM_TOP_RADIUS,
            BEAM_TOP_RADIUS,
            BEAM_LENGTH,
            BEAM_RESOLUTION,
            BEAM_SEGMENTS,
            true
        );

        beamGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -beamGeometry.parameters.height / 2, 0));
        beamGeometry.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
        beamGeometry.applyMatrix4(new THREE.Matrix4().setPosition(0, 0, 0.258));

        const verticesIndexBuffer = [];
        for (let i = 0; i < beamGeometry.attributes.position.count; i++) {
            verticesIndexBuffer[i] = i;
        }
        beamGeometry.setAttribute(
            "index",
            new THREE.BufferAttribute(new Float32Array(verticesIndexBuffer), 1).setUsage(THREE.StaticDrawUsage)
        );

        const beamMesh = new THREE.Mesh(
            beamGeometry,
            new THREE.ShaderMaterial({
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
                        value: this.inputs.camera.getWorldDirection(new THREE.Vector3()),
                    },
                    cameraPos: {
                        value: this.inputs.camera.getWorldPosition(new THREE.Vector3()),
                    },
                    vertexCount: {
                        value: beamGeometry.attributes.position.count,
                    },
                    topRadius: {
                        value: BEAM_TOP_RADIUS,
                    },
                    length: {
                        value: BEAM_LENGTH,
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
            })
        );

        return beamMesh;
    }

    private getCap() {
        const capGeometry = new THREE.CircleGeometry(BEAM_TOP_RADIUS, 40);
        const capMaterial = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
        });

        capGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, 0.255));

        const capMesh = new THREE.Mesh(capGeometry, capMaterial);

        return capMesh;
    }
}
