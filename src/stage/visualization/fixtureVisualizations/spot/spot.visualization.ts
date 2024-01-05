import { markRaw } from "vue";
import * as THREE from "three";

import { BaseFixture, DmxFixture, FixtureType } from "@/stage/fixtures";
import { BaseVisualization, VisualizationType } from "../base.visualization";
import SpotVisualizationSettings from "./SpotVisualizationSettings.vue";

import fragmentShader from "../../shaders/volumetricSpot.frag?raw";
import vertexShader from "../../shaders/volumetricSpot.vert?raw";

export interface SpotVisualizationConfig {
    position: [number, number, number];
    target: [number, number, number];
    colorChannels: [number, number, number];
}

export class SpotVisualization extends BaseVisualization<DmxFixture, SpotVisualizationConfig> {
    public static isCompatibleFixture(fixture: BaseFixture): fixture is DmxFixture {
        return fixture.type === FixtureType.DMX;
    }

    public readonly compatibleFixtures = [FixtureType.DMX];
    public readonly type = VisualizationType.SPOT;

    public override readonly settingsComponent = markRaw(SpotVisualizationSettings);

    private volumeGeometry: THREE.CylinderGeometry;
    private volumeMesh: THREE.Mesh;
    private volumeMaterial: THREE.ShaderMaterial;
    private spotlight: THREE.SpotLight;
    private spotlightTarget: THREE.Object3D;

    constructor(fixture: DmxFixture) {
        super(fixture, {
            position: [0, 0, 0],
            target: [0, 0, 0],
            colorChannels: [0, 0, 0],
        });

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

        const spotPosition = new THREE.Vector3(this.config.position[0], this.config.position[1], this.config.position[2]);
        const targetPosition = new THREE.Vector3(this.config.target[0], this.config.target[1], this.config.target[2]);

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

    protected onFixtureConfigUpdate(): void {}

    protected onFixtureValueUpdate(): void {
        const data = this.fixture.value;
        const red = data[this.config.colorChannels[0]] ?? 0;
        const green = data[this.config.colorChannels[1]] ?? 0;
        const blue = data[this.config.colorChannels[2]] ?? 0;
        const color = new THREE.Color(red / 255, green / 255, blue / 255);
        this.volumeMaterial.uniforms.lightColor.value = color;
        this.spotlight.color = color;
    }
}
