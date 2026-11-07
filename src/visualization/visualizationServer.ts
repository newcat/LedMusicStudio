import { markRaw, toRaw, watch } from "vue";

import { ExtendedMap } from "@/utils";
import { BaseFixture } from "@/stage";
import { useScene } from "@/scene/sceneStore";
import type { SceneSink } from "@/scene/sceneSink";
import { isFixtureVisualization, type FixtureVisualizationObject, type SceneObject } from "@/scene/model/types";
import { FixtureVisualizationController } from "./fixtureVisualizationController";
import { createFixtureVisualizationController } from "./fixtureVisualizations/factory";
import type { FixtureSnapshot } from "./protocol";

interface ControllerEntry {
    controller: FixtureVisualizationController;
    fixtureId: string;
    type: string;
}

/**
 * Fixture-value plumbing: owns one controller per linked fixture visualization object (keyed by object id) and fans
 * their configs and values out to all registered scene sinks.
 */
export class VisualizationServer {
    private paused = false;
    private readonly entries = new Map<string, ControllerEntry>();
    private readonly _controllers = new ExtendedMap<string, FixtureVisualizationController>();

    /** Controllers by scene object id. */
    public get controllers() {
        return this._controllers as ReadonlyMap<string, FixtureVisualizationController>;
    }

    public constructor(private readonly fixtures: Map<string, BaseFixture>) {
        watch(
            () => fixtures.values(),
            () => this.removeObjectsOfDeletedFixtures()
        );
    }

    /** Creates, replaces or removes controllers so that they match the linked fixture visualization objects. */
    public syncWithScene(objects: Record<string, SceneObject>) {
        const wanted = new Map<string, FixtureVisualizationObject>();
        for (const obj of Object.values(objects)) {
            if (isFixtureVisualization(obj) && obj.fixtureId && this.fixtures.has(obj.fixtureId)) {
                wanted.set(obj.id, obj);
            }
        }

        for (const [objectId, entry] of [...this.entries]) {
            const obj = wanted.get(objectId);
            if (!obj || obj.fixtureId !== entry.fixtureId || obj.visualizationType !== entry.type) {
                this.removeController(objectId);
            }
        }

        for (const [objectId, obj] of wanted) {
            const config = structuredClone(toRaw(obj.config));
            const existing = this.entries.get(objectId);
            if (existing) {
                if (JSON.stringify(existing.controller.config) !== JSON.stringify(config)) {
                    existing.controller.config = config;
                }
                continue;
            }
            this.createController(obj, config);
        }
    }

    public getConfigsAndValues(): Record<string, FixtureSnapshot> {
        const result: Record<string, FixtureSnapshot> = {};
        for (const [objectId, { controller }] of this.entries) {
            result[objectId] = { config: toRaw(controller.config), value: toRaw(controller.value) };
        }
        return result;
    }

    /** Sends the current configs and values of all controllers to one sink (used when a view is created). */
    public sendStateTo(sink: SceneSink) {
        const state = this.getConfigsAndValues();
        sink.fixtureConfigs(Object.fromEntries(Object.entries(state).map(([id, s]) => [id, s.config])));
        sink.fixtureValues(Object.fromEntries(Object.entries(state).map(([id, s]) => [id, s.value])));
    }

    public pause() {
        this.paused = true;
    }

    public resume() {
        this.paused = false;
    }

    private createController(obj: FixtureVisualizationObject, config: unknown) {
        const fixture = this.fixtures.get(obj.fixtureId!)!;
        const objectId = obj.id;
        let controller: FixtureVisualizationController;
        try {
            controller = markRaw(createFixtureVisualizationController(obj.visualizationType, fixture));
        } catch (err) {
            console.error(`Could not create visualization for "${obj.name}"`, err);
            return;
        }
        this.entries.set(objectId, { controller, fixtureId: fixture.id, type: obj.visualizationType });
        this._controllers.set(objectId, controller);

        controller.config = config;
        controller.events.configChanged.subscribe(this, (c) => {
            useScene().forEachSink((sink) => sink.fixtureConfigs({ [objectId]: toRaw(c) }));
        });
        controller.events.valueChanged.subscribe(this, (value) => {
            if (this.paused) {
                return;
            }
            useScene().forEachSink((sink) => sink.fixtureValues({ [objectId]: toRaw(value) }));
        });

        useScene().forEachSink((sink) => {
            sink.fixtureConfigs({ [objectId]: toRaw(controller.config) });
            sink.fixtureValues({ [objectId]: toRaw(controller.value) });
        });
    }

    private removeController(objectId: string) {
        const entry = this.entries.get(objectId);
        if (!entry) {
            return;
        }
        entry.controller.events.configChanged.unsubscribe(this);
        entry.controller.events.valueChanged.unsubscribe(this);
        entry.controller.dispose();
        this.entries.delete(objectId);
        this._controllers.delete(objectId);
    }

    /** Data-model invariant 5: deleting a fixture removes its visualization object, outside the history. */
    private removeObjectsOfDeletedFixtures() {
        const scene = useScene();
        const toRemove: string[] = [];
        for (const obj of Object.values(scene.rawScene().objects)) {
            if (isFixtureVisualization(obj) && obj.fixtureId && !this.fixtures.has(obj.fixtureId)) {
                toRemove.push(obj.id);
            }
        }
        if (toRemove.length > 0) {
            scene.removeObjectsWithoutHistory(toRemove);
        }
    }
}
