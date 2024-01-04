import * as THREE from "three";

import { IDmxOutputData } from "@/output/dmx/dmx.output";
import fragmentShader from "../../shaders/volumetricSpot.frag?raw";
import vertexShader from "../../shaders/volumetricSpot.vert?raw";
import { SpotStageFixture } from "./spot.fixture";
import { ThreeBaseFixture } from "../base.three";

export class ThreeSpotFixture extends ThreeBaseFixture {
    private volumeGeometry: THREE.CylinderGeometry;
    private volumeMesh: THREE.Mesh;
    private volumeMaterial: THREE.ShaderMaterial;
    private spotlight: THREE.SpotLight;
    private spotlightTarget: THREE.Object3D;

    constructor(private readonly fixture: SpotStageFixture, scene: THREE.Scene) {
        super();

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

        const spotPosition = new THREE.Vector3(fixture.position[0], fixture.position[1], fixture.position[2]);
        const targetPosition = new THREE.Vector3(fixture.target[0], fixture.target[1], fixture.target[2]);

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

    public updateData(outputData: Map<string, any>) {
        const data = outputData.get(this.fixture.outputId) as IDmxOutputData | undefined;
        if (!data) {
            return;
        }

        const red = data.channels.get(this.fixture.colorChannels[0]) ?? 0;
        const green = data.channels.get(this.fixture.colorChannels[1]) ?? 0;
        const blue = data.channels.get(this.fixture.colorChannels[2]) ?? 0;
        const color = new THREE.Color(red / 255, green / 255, blue / 255);
        this.volumeMaterial.uniforms.lightColor.value = color;
        this.spotlight.color = color;
    }

    public override dispose(): void {
        this.remove();
        this.volumeMaterial.dispose();
        this.spotlight.dispose();
    }
}
