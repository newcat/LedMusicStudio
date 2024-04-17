import { markRaw, watch } from "vue";

import { ExtendedMap } from "@/utils";
import { BaseFixture } from "@/stage";
import { VisualizationType } from "./fixtureVisualization";
import { FixtureVisualizationController, FixtureVisualizationState } from "./fixtureVisualizationController";
import { createFixtureVisualizationController } from "./fixtureVisualizations/factory";
import { StageRendererPayloads, StageRendererMessage } from "./stageRenderer";

export interface VisualizationServerState {
    baseScene: unknown;
    visualizationStates: Record<string, FixtureVisualizationState>;
}

export class VisualizationServer {
    private baseScene: unknown = null;
    private paused = false;
    private _controllers: ExtendedMap<string, FixtureVisualizationController> = new ExtendedMap();
    private readonly bc = new BroadcastChannel("visualization");

    public get isSceneLoaded() {
        return this.baseScene !== null;
    }

    public get controllers() {
        return this._controllers as ReadonlyMap<string, FixtureVisualizationController>;
    }

    public constructor(private readonly fixtures: Map<string, BaseFixture>) {
        watch(
            () => fixtures.values(),
            () => this.updateFixtures()
        );

        this.bc.addEventListener("message", (ev) => {
            const data = JSON.parse(ev.data);
            if (data.type === "ready") {
                if (this.baseScene) {
                    this.send("loadScene", this.baseScene);
                }
                for (const [fixtureId, controller] of this.controllers.entries()) {
                    this.send("createFixtureRenderer", fixtureId, controller.visualization.type, controller.config as any);
                    this.send("onFixtureConfigUpdate", fixtureId, controller.config as any);
                    this.send("onFixtureValueUpdate", fixtureId, controller.value as any);
                }
            }
        });
    }

    public setVisualization(fixtureId: string, visualizationType: VisualizationType | null, state?: FixtureVisualizationState) {
        this.removeVisualization(fixtureId);

        const fixture = this.fixtures.get(fixtureId);
        if (!visualizationType || !fixture) {
            return;
        }

        const newVisualization = markRaw(createFixtureVisualizationController(visualizationType, fixture));
        if (state) {
            newVisualization.load(state);
        }
        this._controllers.set(fixtureId, newVisualization);

        newVisualization.events.configChanged.subscribe(this, (config) => {
            this.send("onFixtureConfigUpdate", fixtureId, config);
        });
        newVisualization.events.valueChanged.subscribe(this, (value) => {
            if (this.paused) {
                return;
            }

            this.send("onFixtureValueUpdate", fixtureId, value);
        });

        this.send("createFixtureRenderer", fixtureId, visualizationType, newVisualization.config);
        this.send("onFixtureConfigUpdate", fixtureId, newVisualization.config);
        this.send("onFixtureValueUpdate", fixtureId, newVisualization.value);
    }

    public loadScene(baseScene: any) {
        this.baseScene = baseScene;
        this.send("loadScene", baseScene);
    }

    public save(): VisualizationServerState {
        return {
            baseScene: this.baseScene,
            visualizationStates: Object.fromEntries(
                Array.from(this.controllers.entries()).map(([fixtureId, visualization]) => [fixtureId, visualization.save()])
            ),
        };
    }

    public load(state: VisualizationServerState) {
        if (state.baseScene) {
            this.loadScene(state.baseScene);
        }
        for (const [fixtureId, visualizationState] of Object.entries(state.visualizationStates)) {
            this.setVisualization(fixtureId, visualizationState.type, visualizationState);
        }
    }

    public reset() {
        this._controllers.clear();
        this.send("reset");
    }

    public pause() {
        this.paused = true;
    }

    public resume() {
        this.paused = false;
    }

    private updateFixtures() {
        const fixturesToRemove = new Set(this.controllers.keys());
        for (const fixture of this.fixtures.values()) {
            fixturesToRemove.delete(fixture.id);
        }

        for (const fixtureId of fixturesToRemove) {
            this.removeVisualization(fixtureId);
        }
    }

    private removeVisualization(fixtureId: string) {
        const visualization = this.controllers.get(fixtureId);
        if (visualization) {
            visualization.events.configChanged.unsubscribe(this);
            visualization.events.valueChanged.unsubscribe(this);
            this.send("removeFixtureRenderer", fixtureId);
            this._controllers.delete(fixtureId);
        }
    }

    private send<K extends keyof StageRendererPayloads>(type: K, ...args: StageRendererPayloads[K]) {
        const msg: StageRendererMessage<K> = {
            type,
            payload: args,
        };
        this.bc.postMessage(JSON.stringify(msg));
    }
}
