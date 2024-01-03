import * as THREE from "three";
import { BaseStageFixture, ThreeBaseFixture } from "./fixtures";

export class StageScene {
    public readonly scene: THREE.Scene;
    public readonly camera: THREE.PerspectiveCamera;

    public outputData: Map<string, any> = new Map();
    private fixtureInstances: ThreeBaseFixture[] = [];

    public constructor(public readonly baseScene: any) {
        const loader = new THREE.ObjectLoader();
        this.scene = loader.parse(baseScene) as THREE.Scene;

        this.camera = this.scene.children.find((child) => child.type === "PerspectiveCamera") as THREE.PerspectiveCamera;
        if (!this.camera) {
            throw new Error("No camera found in scene");
        }
    }

    public applyFixtures(fixtures: BaseStageFixture[]) {
        for (const fixtureInstance of this.fixtureInstances) {
            fixtureInstance.dispose();
            this.scene.remove(fixtureInstance);
        }

        this.fixtureInstances = [];

        for (const fixture of fixtures) {
            if (!fixture.isValid) {
                console.warn(`Fixture ${fixture.name} is not valid`, fixture);
                continue;
            }
            const fixtureInstance = fixture.createThreeInstance(this.scene);
            this.fixtureInstances.push(fixtureInstance);
            this.scene.add(fixtureInstance);
        }
    }

    public updateFixtureData() {
        for (const fixture of this.fixtureInstances) {
            fixture.updateData(this.outputData);
        }
    }
}
