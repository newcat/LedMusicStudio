import * as THREE from "three";

export class StageScene {
    public readonly scene: THREE.Scene;
    public readonly camera: THREE.PerspectiveCamera;

    public constructor(private readonly baseScene: any) {
        const loader = new THREE.ObjectLoader();
        this.scene = loader.parse(baseScene) as THREE.Scene;

        this.camera = this.scene.children.find((child) => child.type === "PerspectiveCamera") as THREE.PerspectiveCamera;
        if (!this.camera) {
            throw new Error("No camera found in scene");
        }
    }

    public loadFixtures() {}
}
