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

function degToRad(degAngle: number) {
    return degAngle * (Math.PI / 180);
}

export class MovingHeadRenderer extends BaseRenderer<MovingHeadVisualizationConfig, number[]> {
    private readonly base: THREE.Mesh;
    private readonly head: THREE.Mesh;
    private readonly yoke: THREE.Mesh;
    private readonly beam;
    private readonly cap;
    private readonly target = new THREE.Object3D();
    private readonly spotlight: THREE.SpotLight;

    public constructor(inputs: RendererInputs) {
        super(inputs);

        const model = modelLibrary.getModel("MovingHead").children[0].clone();
        this.base = model.getObjectByName("base_001")! as THREE.Mesh;
        this.yoke = model.getObjectByName("yoke_001")! as THREE.Mesh;
        this.head = model.getObjectByName("head_001")! as THREE.Mesh;

        this.spotlight = new THREE.SpotLight(
            0xffffff,
            SPOTLIGHT_PHYSICALLY_CORRECT_INTENSITY,
            SPOTLIGHT_PHYSICALLY_CORRECT_DISTANCE,
            degToRad(15),
            SPOTLIGHT_PHYSICALLY_CORRECT_PENUMBRA,
            SPOTLIGHT_PHYSICALLY_CORRECT_DECAY
        );
        this.spotlight.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -0.73, 0));

        this.target.translateY(10);

        this.beam = this.getBeam();
        this.cap = this.getCap();

        this.base.attach(this.yoke);
        this.yoke.attach(this.head);
        this.head.attach(this.beam);
        this.head.attach(this.cap);
        this.head.attach(this.spotlight);
        this.head.attach(this.target);
        this.spotlight.target = this.target;

        this.head.attach(new THREE.Mesh(new THREE.SphereGeometry(0.05)));

        const bh = new THREE.BoxHelper(this.beam, 0xffff00);
        this.head.attach(bh);
        bh.update();

        this.add(this.base);

        this.yoke.rotateY(Math.PI / 4);
        this.head.rotateX(Math.PI / 4);
    }

    public onConfigUpdate(c: MovingHeadVisualizationConfig): void {
        // TODO
    }

    public onFixtureValueUpdate(v: number[]): void {
        // TODO
    }

    private getBeam() {
        const beamLength = BEAM_LENGTH;
        const beamGeometry = new THREE.CylinderGeometry(BEAM_TOP_RADIUS, BEAM_TOP_RADIUS, beamLength, BEAM_RESOLUTION, BEAM_SEGMENTS, true);

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
            })
        );

        // beamMesh.rotateX(Math.PI);
        beamMesh.translateY(beamGeometry.parameters.height / 2 + 0.73);

        return beamMesh;
    }

    private getCap() {
        const capGeometry = new THREE.CircleGeometry(BEAM_TOP_RADIUS, 40);
        const capMaterial = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
        });

        capGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, 0.73));
        capGeometry.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

        const capMesh = new THREE.Mesh(capGeometry, capMaterial);
        return capMesh;
    }
}
