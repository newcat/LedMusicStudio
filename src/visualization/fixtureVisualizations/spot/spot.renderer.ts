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
    private proxy: THREE.Mesh | null = null;
    private config: SpotVisualizationConfig = { colorChannels: [-1, -1, -1, -1] };
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

        // the cone starts at the local origin and widens along local -Y
        this.volumeGeometry = new THREE.CylinderGeometry(0.1, 1.5, 15, 32 * 2, 20, true);
        this.volumeGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -this.volumeGeometry.parameters.height / 2, 0));
        this.volumeMesh = new THREE.Mesh(this.volumeGeometry, this.volumeMaterial);
        // the beam must not be hit by picking rays (research R8)
        this.volumeMesh.raycast = () => undefined;
        this.volumeMesh.userData.excludeFromBounds = true;
        this.add(this.volumeMesh);

        this.spotlightTarget = new THREE.Object3D();
        this.spotlightTarget.position.set(0, -1, 0);
        this.spotlight = new THREE.SpotLight(0xffffff, 1, 100, Math.PI / 22, 0.5, 1);
        this.spotlight.target = this.spotlightTarget;
        this.add(this.spotlight);
        this.add(this.spotlightTarget);
    }

    public override dispose() {
        this.remove(this.volumeMesh);
        this.remove(this.spotlight);
        this.remove(this.spotlightTarget);
        this.volumeGeometry.dispose();
        this.volumeMaterial.dispose();
        this.spotlight.dispose();
        if (this.proxy) {
            this.proxy.geometry.dispose();
            (this.proxy.material as THREE.Material).dispose();
        }

        super.dispose();
    }

    public override onConfigUpdate(c: SpotVisualizationConfig) {
        this.config = c;
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

    public override getSurfaceLight(): THREE.Light {
        return this.spotlight;
    }

    public override updateWorld(): void {
        this.volumeMesh.getWorldPosition(this.worldPosition);
        (this.volumeMaterial.uniforms.spotPosition.value as THREE.Vector3).copy(this.worldPosition);
    }

    /** A small cone at the origin, tip pointing along the emission direction (-Y). */
    public override createEditorProxy(): THREE.Object3D {
        if (!this.proxy) {
            const geometry = new THREE.ConeGeometry(0.1, 0.2, 16);
            // base at the origin, tip pointing down
            geometry.rotateX(Math.PI);
            geometry.translate(0, -0.1, 0);
            this.proxy = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xcccccc }));
        }
        return this.proxy;
    }
}
