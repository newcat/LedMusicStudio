import * as THREE from "three";

import fragmentShader from "../../shaders/volumetricSpot.frag?raw";
import vertexShader from "../../shaders/volumetricSpot.vert?raw";
import { BaseRenderer, RendererInputs } from "../base.renderer";
import { SpotVisualizationConfig } from "./types";

export class SpotRenderer extends BaseRenderer<SpotVisualizationConfig, number[]> {
    private volumeGeometry: THREE.CylinderGeometry;
    private volumeMesh: THREE.Mesh;
    private volumeMaterial: THREE.ShaderMaterial;
    private spotlight: THREE.SpotLight;
    private spotlightTarget: THREE.Object3D;
    private config!: SpotVisualizationConfig;

    constructor(inputs: RendererInputs) {
        super(inputs);

        this.volumeMaterial = new THREE.ShaderMaterial({
            uniforms: {
                attenuation: { value: 4.4 },
                anglePower: { value: 2.6 },
                spotPosition: { value: new THREE.Vector3(0, 0, 0) },
                lightColor: { value: new THREE.Color("cyan") },
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.FrontSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
        });

        const spotPosition = new THREE.Vector3(0, 0, 0);
        const targetPosition = new THREE.Vector3(0, 0, 0);

        this.volumeGeometry = new THREE.CylinderGeometry(0.1, 1.5, 15, 32 * 2, 20, true);
        this.volumeGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -this.volumeGeometry.parameters.height / 2, 0));
        this.volumeGeometry.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
        this.volumeMesh = new THREE.Mesh(this.volumeGeometry, this.volumeMaterial);
        this.volumeMesh.position.copy(spotPosition);
        this.volumeMesh.lookAt(targetPosition);
        this.volumeMaterial.uniforms.lightColor.value.set("white");
        this.volumeMaterial.uniforms.spotPosition.value = this.volumeMesh.position;
        this.add(this.volumeMesh);

        this.spotlightTarget = new THREE.Object3D();
        this.spotlight = new THREE.SpotLight(0xffffff, 1, 100, Math.PI / 22, 0.5, 1);
        this.spotlight.target = this.spotlightTarget;
        this.spotlight.position.copy(spotPosition);
        this.spotlight.target.position.copy(targetPosition);
        this.add(this.spotlight);
        this.add(this.spotlightTarget);
    }

    public dispose() {
        this.remove(this.volumeMesh);
        this.remove(this.spotlight);
        this.remove(this.spotlightTarget);
        this.volumeGeometry.dispose();
        this.volumeMaterial.dispose();
        this.spotlight.dispose();

        super.dispose();
    }

    public override onConfigUpdate(c: SpotVisualizationConfig) {
        this.config = c;

        const spotPosition = new THREE.Vector3(c.position[0], c.position[1], c.position[2]);
        const targetPosition = new THREE.Vector3(c.target[0], c.target[1], c.target[2]);

        this.volumeMesh.position.copy(spotPosition);
        this.volumeMesh.lookAt(targetPosition);
        this.volumeMaterial.uniforms.spotPosition.value = this.volumeMesh.position;

        this.spotlight.position.copy(spotPosition);
        this.spotlightTarget.position.copy(targetPosition);
    }

    public override onFixtureValueUpdate(data: number[]): void {
        const [redChannel, greenChannel, blueChannel, whiteChannel] = this.config.colorChannels;
        const red = redChannel >= 0 ? data[redChannel] ?? 0 : 0;
        const green = greenChannel >= 0 ? data[greenChannel] ?? 0 : 0;
        const blue = blueChannel >= 0 ? data[blueChannel] ?? 0 : 0;
        const white = whiteChannel >= 0 ? data[whiteChannel] ?? 0 : 0;
        const color = new THREE.Color(red / 255, green / 255, blue / 255);
        color.addScalar(white / 255);
        this.volumeMaterial.uniforms.lightColor.value = color;
        this.spotlight.color = color;
    }
}
