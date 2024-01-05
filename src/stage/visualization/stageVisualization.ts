import * as THREE from "three";
import { BaseVisualization, VisualizationType } from "./fixtureVisualizations/base.visualization";
import { BaseFixture } from "../fixtures";
import { markRaw, watch } from "vue";
import { createFixtureVisualization } from "./fixtureVisualizations/factory";

export class StageVisualization {
    private _scene: THREE.Scene | null = null;
    private _camera: THREE.PerspectiveCamera | null = null;
    private _visualizations: Map<string, BaseVisualization> = new Map();

    public get visualizations() {
        return this._visualizations as ReadonlyMap<string, BaseVisualization>;
    }

    public get scene() {
        return this._scene;
    }

    public get camera() {
        return this._camera;
    }

    public constructor(private readonly fixtures: Map<string, BaseFixture>) {
        watch(fixtures, () => this.updateFixtures(), { deep: true });
    }

    public setVisualization(fixtureId: string, visualizationType: VisualizationType | null) {
        this.removeVisualization(fixtureId);

        const fixture = this.fixtures.get(fixtureId);
        if (!visualizationType || !fixture) {
            return;
        }

        const newVisualization = createFixtureVisualization(visualizationType, fixture);
        this._visualizations.set(fixtureId, newVisualization);
    }

    public loadScene(baseScene: any) {
        const loader = new THREE.ObjectLoader();
        this._scene = markRaw(loader.parse(baseScene) as THREE.Scene);

        this._camera = this._scene.children.find((child) => child.type === "PerspectiveCamera") as THREE.PerspectiveCamera;
        if (!this.camera) {
            throw new Error("No camera found in scene");
        }

        for (const visualization of this.visualizations.values()) {
            this._scene.add(visualization);
        }
    }

    private updateFixtures() {
        const fixturesToRemove = new Set(this.visualizations.keys());
        for (const fixture of this.fixtures.values()) {
            fixturesToRemove.delete(fixture.id);
        }

        for (const fixtureId of fixturesToRemove) {
            this.removeVisualization(fixtureId);
        }
    }

    private removeVisualization(fixtureId: string) {
        const visualization = this.visualizations.get(fixtureId);
        if (visualization) {
            this.scene?.remove(visualization);
            visualization.dispose();
            this._visualizations.delete(fixtureId);
        }
    }
}
