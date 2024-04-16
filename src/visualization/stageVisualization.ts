import { markRaw, watch } from "vue";

import { ExtendedMap } from "@/utils";
import { useStage, BaseFixture } from "@/stage";
import { BaseVisualization, VisualizationState, VisualizationType } from "./fixtureVisualizations/base.visualization";
import { createFixtureVisualization } from "./fixtureVisualizations/factory";

export interface StageVisualizationState {
    baseScene: unknown;
    visualizationStates: Record<string, VisualizationState>;
}

export class StageVisualization {
    private baseScene: unknown = null;
    private _visualizations: ExtendedMap<string, BaseVisualization> = new ExtendedMap();

    public get isSceneLoaded() {
        return this.baseScene !== null;
    }

    public get visualizations() {
        return this._visualizations as ReadonlyMap<string, BaseVisualization>;
    }

    public constructor(private readonly fixtures: Map<string, BaseFixture>) {
        watch(
            () => fixtures.values(),
            () => this.updateFixtures()
        );
    }

    public setVisualization(fixtureId: string, visualizationType: VisualizationType | null, state?: VisualizationState) {
        this.removeVisualization(fixtureId);

        const fixture = this.fixtures.get(fixtureId);
        if (!visualizationType || !fixture) {
            return;
        }

        const newVisualization = markRaw(createFixtureVisualization(visualizationType, fixture));
        if (state) {
            newVisualization.load(state);
        }
        this._visualizations.set(fixtureId, newVisualization);
    }

    public async loadScene(baseScene: any) {
        this.baseScene = baseScene;
        await useStage().renderer.loadScene(baseScene);
    }

    public save(): StageVisualizationState {
        return {
            baseScene: this.baseScene,
            visualizationStates: Object.fromEntries(
                Array.from(this.visualizations.entries()).map(([fixtureId, visualization]) => [fixtureId, visualization.save()])
            ),
        };
    }

    public async load(state: StageVisualizationState) {
        if (state.baseScene) {
            await this.loadScene(state.baseScene);
        }
        for (const [fixtureId, visualizationState] of Object.entries(state.visualizationStates)) {
            this.setVisualization(fixtureId, visualizationState.type, visualizationState);
        }
    }

    public reset() {
        this._visualizations.clear();
    }

    public pause() {
        for (const visualization of this.visualizations.values()) {
            visualization.pause();
        }
    }

    public resume() {
        for (const visualization of this.visualizations.values()) {
            visualization.resume();
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
            this._visualizations.delete(fixtureId);
        }
    }
}
