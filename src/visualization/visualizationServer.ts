import { markRaw, toRaw } from "vue";

import { ExtendedMap } from "@/utils";
import { BaseFixture } from "@/stage";
import { useScene } from "@/scene/sceneStore";
import type { SceneSink } from "@/scene/sceneSink";
import { isFixtureVisualization, type FixtureVisualizationObject, type SceneObject } from "@/scene/model/types";
import { FixtureVisualizationController } from "./fixtureVisualizationController";
import { createFixtureVisualizationController } from "./fixtureVisualizations/factory";
import { VisualizationType } from "./fixtureVisualization";
import type { FixtureSnapshot } from "./protocol";

interface ControllerEntry {
    controller: FixtureVisualizationController;
    fixtureId: string;
    /** The fixture instance the controller was created for; a fixture restored by undo is a new instance. */
    fixture: BaseFixture;
    type: string;
    /** The controller's current value in wire encoding (protocol v3). */
    wire: Uint8Array;
}

function toByte(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(255, Math.max(0, Math.round(n))) : 0;
}

/**
 * Controller value → protocol v3 encoding (contracts/show-window-protocol-v3.md → Value encoding): DMX channel values
 * as bytes; LED strip `Color[]` as flat `[r0, g0, b0, r1, …]` of length 3 × numLeds.
 */
export function toWireValue(type: string, value: unknown): Uint8Array {
    if (value instanceof Uint8Array) {
        return value;
    }
    if (!Array.isArray(value)) {
        return new Uint8Array(0);
    }
    if (type === VisualizationType.LED_STRIP) {
        const bytes = new Uint8Array(value.length * 3);
        value.forEach((c: unknown, i) => {
            const color = Array.isArray(c) ? (c as unknown[]) : [];
            bytes[i * 3] = toByte(color[0]);
            bytes[i * 3 + 1] = toByte(color[1]);
            bytes[i * 3 + 2] = toByte(color[2]);
        });
        return bytes;
    }
    return Uint8Array.from(value as unknown[], toByte);
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
        // a sink that becomes active gets the full fixture state (research R15)
        useScene().onSinkRegistered((sink) => sink.onActivated(() => this.sendStateTo(sink)));
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
            if (!obj || obj.fixtureId !== entry.fixtureId || obj.visualizationType !== entry.type || this.fixtures.get(obj.fixtureId) !== entry.fixture) {
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
        for (const [objectId, { controller, wire }] of this.entries) {
            result[objectId] = { config: toRaw(controller.config), value: wire };
        }
        return result;
    }

    /**
     * Sends the current configs and values of all controllers to one sink (when a view is created or turns active).
     * Values only go to active sinks (FR-053); an inactive sink gets them when it is activated.
     */
    public sendStateTo(sink: SceneSink) {
        const state = this.getConfigsAndValues();
        sink.fixtureConfigs(Object.fromEntries(Object.entries(state).map(([id, s]) => [id, s.config])));
        if (sink.active) {
            sink.fixtureValues(Object.fromEntries(Object.entries(state).map(([id, s]) => [id, s.value])));
        }
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
        const type = obj.visualizationType;
        const entry: ControllerEntry = { controller, fixtureId: fixture.id, fixture, type, wire: toWireValue(type, toRaw(controller.value)) };
        this.entries.set(objectId, entry);
        this._controllers.set(objectId, controller);

        controller.config = config;
        controller.events.configChanged.subscribe(this, (c) => {
            useScene().forEachSink((sink) => sink.fixtureConfigs({ [objectId]: toRaw(c) }));
        });
        controller.events.valueChanged.subscribe(this, (value) => {
            // converted once before fan-out, so all sinks get the same object
            entry.wire = toWireValue(type, toRaw(value));
            if (this.paused) {
                return;
            }
            useScene().forEachActiveSink((sink) => sink.fixtureValues({ [objectId]: entry.wire }));
        });

        useScene().forEachSink((sink) => sink.fixtureConfigs({ [objectId]: toRaw(controller.config) }));
        useScene().forEachActiveSink((sink) => sink.fixtureValues({ [objectId]: entry.wire }));
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
}
