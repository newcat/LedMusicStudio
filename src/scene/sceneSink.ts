import type { SceneView, VizStats } from "@/visualization/sceneView";
import {
    CHANNEL_NAME,
    PROTOCOL_VERSION,
    isProtocolMessage,
    type FixtureSnapshot,
    type MainToShowMessage,
    type ShowWindowMessage,
} from "@/visualization/protocol";
import type { CameraPosition, SceneAsset, SceneEnvironment, SceneObject, SceneState } from "./model/types";

/** Dev only (T076): counts fixture values handed to a view or posted to show windows in `window.__lmsVizStats`. */
function countValuesPosted(count: number) {
    if (!import.meta.env.DEV || typeof window === "undefined" || count === 0) {
        return;
    }
    const stats: VizStats = (window.__lmsVizStats ??= { framesRendered: 0, valuesPosted: 0 });
    stats.valuesPosted += count;
}

/**
 * Receives every change of the scene. The embedded editor's view and the show windows are sinks.
 * Objects handed to a sink are plain (non-reactive) data and must not be modified by the sink.
 */
export interface SceneSink {
    /** False while no consumer is visible; the VisualizationServer sends no values to inactive sinks (FR-053). */
    readonly active: boolean;
    /** Fired when `active` turns true; the server then sends the full fixture state. */
    onActivated(cb: () => void): () => void;
    reset(scene: SceneState): void;
    objectsChanged(objects: SceneObject[], rootOrder: string[]): void;
    objectsRemoved(ids: string[]): void;
    asset(id: string, mimeType: string, data: Uint8Array): void;
    camerasChanged(cameras: CameraPosition[]): void;
    environmentChanged(environment: SceneEnvironment): void;
    fixtureConfigs(configs: Record<string, unknown>): void;
    fixtureValues(values: Record<string, Uint8Array>): void;
}

/** Forwards to a `SceneView` in the same window. */
export class LocalSceneSink implements SceneSink {
    private readonly activatedCallbacks = new Set<() => void>();

    public constructor(private readonly view: SceneView) {
        view.onActiveChange((active) => {
            if (active) {
                for (const cb of this.activatedCallbacks) {
                    cb();
                }
            }
        });
    }

    public get active() {
        return this.view.active;
    }

    public onActivated(cb: () => void) {
        this.activatedCallbacks.add(cb);
        return () => {
            this.activatedCallbacks.delete(cb);
        };
    }

    public environmentChanged(environment: SceneEnvironment) {
        this.view.setEnvironment(environment);
    }

    public reset(scene: SceneState) {
        for (const asset of Object.values(scene.assets)) {
            this.view.setAsset(asset.id, asset.data);
        }
        this.view.setScene(scene);
    }

    public objectsChanged(objects: SceneObject[]) {
        this.view.applyObjects(objects);
    }

    public objectsRemoved(ids: string[]) {
        this.view.removeObjects(ids);
    }

    public asset(id: string, _mimeType: string, data: Uint8Array) {
        this.view.setAsset(id, data);
    }

    public camerasChanged() {
        // the embedded editor reads the cameras from the store
    }

    public fixtureConfigs(configs: Record<string, unknown>) {
        for (const [id, config] of Object.entries(configs)) {
            this.view.setFixtureConfig(id, config);
        }
    }

    public fixtureValues(values: Record<string, Uint8Array>) {
        let count = 0;
        for (const [id, value] of Object.entries(values)) {
            this.view.setFixtureValue(id, value);
            count++;
        }
        countValuesPosted(count);
    }
}

export interface BroadcastSceneSinkProvider {
    getScene(): SceneState;
    getFixtures(): Record<string, FixtureSnapshot>;
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

/** A show window is gone after this long without a heartbeat (research R15). */
const WINDOW_TIMEOUT_MS = 6000;
const WINDOW_CHECK_INTERVAL_MS = 1000;

interface ShowWindowState {
    lastSeen: number;
    visible: boolean;
}

/** Main-window side of the show window protocol (contracts/show-window-protocol-v3.md). */
export class BroadcastSceneSink implements SceneSink {
    private readonly channel = new BroadcastChannel(CHANNEL_NAME);
    /** Alive show windows by window id. */
    private readonly windows = new Map<string, ShowWindowState>();
    private readonly activatedCallbacks = new Set<() => void>();
    private readonly checkInterval: ReturnType<typeof setInterval>;
    private isActive = false;

    private pendingObjects = new Map<string, SceneObject>();
    private pendingRootOrder: string[] | null = null;
    private pendingRemoved = new Set<string>();
    private pendingEnvironment: SceneEnvironment | null = null;
    private pendingConfigs: Record<string, unknown> = {};
    private pendingValues: Record<string, Uint8Array> = {};
    private frameHandle: number | null = null;
    private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    public constructor(private readonly provider: BroadcastSceneSinkProvider) {
        this.channel.addEventListener("message", (ev: MessageEvent<unknown>) => this.onMessage(ev.data));
        this.checkInterval = setInterval(() => this.removeTimedOutWindows(), WINDOW_CHECK_INTERVAL_MS);
    }

    /** At least one alive show window whose last reported visibility was `visible`. */
    public get active() {
        return this.isActive;
    }

    public get windowCount() {
        return this.windows.size;
    }

    public onActivated(cb: () => void) {
        this.activatedCallbacks.add(cb);
        return () => {
            this.activatedCallbacks.delete(cb);
        };
    }

    public reset() {
        this.discardPending();
        this.post({ protocol: PROTOCOL_VERSION, type: "reset" });
        for (const windowId of this.windows.keys()) {
            this.sendSnapshot(windowId);
        }
    }

    public environmentChanged(environment: SceneEnvironment) {
        this.pendingEnvironment = environment;
        this.schedule();
    }

    public objectsChanged(objects: SceneObject[], rootOrder: string[]) {
        for (const obj of objects) {
            this.pendingObjects.set(obj.id, obj);
            this.pendingRemoved.delete(obj.id);
        }
        this.pendingRootOrder = rootOrder;
        this.schedule();
    }

    public objectsRemoved(ids: string[]) {
        for (const id of ids) {
            this.pendingObjects.delete(id);
            this.pendingRemoved.add(id);
        }
        this.schedule();
    }

    public asset(id: string, mimeType: string, data: Uint8Array) {
        // the asset has to arrive before the objects that reference it
        this.flush();
        this.post({ protocol: PROTOCOL_VERSION, type: "asset", target: "*", assetId: id, mimeType, data: toArrayBuffer(data) });
    }

    public camerasChanged(cameras: CameraPosition[]) {
        this.post({ protocol: PROTOCOL_VERSION, type: "camerasChanged", cameras });
    }

    public fixtureConfigs(configs: Record<string, unknown>) {
        Object.assign(this.pendingConfigs, configs);
        this.schedule();
    }

    /** Dropped while no show window is visible (FR-053, SC-006). */
    public fixtureValues(values: Record<string, Uint8Array>) {
        if (!this.isActive) {
            return;
        }
        Object.assign(this.pendingValues, values);
        this.schedule();
    }

    public dispose() {
        clearInterval(this.checkInterval);
        this.discardPending();
        this.activatedCallbacks.clear();
        this.windows.clear();
        this.channel.close();
    }

    private onMessage(raw: unknown) {
        if (!isProtocolMessage(raw) || raw.protocol !== PROTOCOL_VERSION) {
            return;
        }
        const data = raw as ShowWindowMessage;
        switch (data.type) {
            case "hello":
                this.windows.set(data.windowId, { lastSeen: performance.now(), visible: true });
                this.sendSnapshot(data.windowId);
                break;
            case "heartbeat": {
                const known = this.windows.get(data.windowId);
                this.windows.set(data.windowId, { lastSeen: performance.now(), visible: data.visible });
                if (!known) {
                    // a window that said hello to an earlier main window (e.g. before a reload) needs the scene
                    this.sendSnapshot(data.windowId);
                }
                break;
            }
            case "bye":
                this.windows.delete(data.windowId);
                break;
            default:
                return;
        }
        this.updateActive();
    }

    private removeTimedOutWindows() {
        const now = performance.now();
        let changed = false;
        for (const [windowId, state] of this.windows) {
            if (now - state.lastSeen > WINDOW_TIMEOUT_MS) {
                this.windows.delete(windowId);
                changed = true;
            }
        }
        if (changed) {
            this.updateActive();
        }
    }

    private updateActive() {
        let active = false;
        for (const state of this.windows.values()) {
            if (state.visible) {
                active = true;
                break;
            }
        }
        if (active === this.isActive) {
            return;
        }
        this.isActive = active;
        if (!active) {
            this.pendingValues = {};
            return;
        }
        for (const cb of this.activatedCallbacks) {
            cb();
        }
    }

    private sendSnapshot(windowId: string) {
        this.flush();
        const scene = this.provider.getScene();
        const { assets, ...sceneWithoutAssets } = scene;
        this.post({
            protocol: PROTOCOL_VERSION,
            type: "snapshot",
            target: windowId,
            scene: sceneWithoutAssets,
            fixtures: this.provider.getFixtures(),
        });
        for (const asset of Object.values(assets) as SceneAsset[]) {
            this.post({
                protocol: PROTOCOL_VERSION,
                type: "asset",
                target: windowId,
                assetId: asset.id,
                mimeType: asset.mimeType,
                data: toArrayBuffer(asset.data),
            });
        }
    }

    /** Batches per animation frame; the timeout covers hidden or minimized main windows where frames stop. */
    private schedule() {
        if (this.frameHandle !== null || this.timeoutHandle !== null) {
            return;
        }
        this.frameHandle = requestAnimationFrame(() => this.flush());
        this.timeoutHandle = setTimeout(() => this.flush(), 50);
    }

    private flush() {
        if (this.frameHandle !== null) {
            cancelAnimationFrame(this.frameHandle);
            this.frameHandle = null;
        }
        if (this.timeoutHandle !== null) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        }

        if (this.pendingRemoved.size > 0) {
            this.post({ protocol: PROTOCOL_VERSION, type: "objectsRemoved", ids: [...this.pendingRemoved] });
            this.pendingRemoved.clear();
        }
        if (this.pendingObjects.size > 0) {
            this.post({
                protocol: PROTOCOL_VERSION,
                type: "objectsChanged",
                objects: [...this.pendingObjects.values()],
                rootOrder: this.pendingRootOrder ?? [],
            });
            this.pendingObjects.clear();
            this.pendingRootOrder = null;
        }
        if (this.pendingEnvironment) {
            this.post({ protocol: PROTOCOL_VERSION, type: "environmentChanged", environment: this.pendingEnvironment });
            this.pendingEnvironment = null;
        }
        if (Object.keys(this.pendingConfigs).length > 0) {
            this.post({ protocol: PROTOCOL_VERSION, type: "fixtureConfigs", configs: this.pendingConfigs });
            this.pendingConfigs = {};
        }
        const valueCount = Object.keys(this.pendingValues).length;
        if (valueCount > 0) {
            this.post({ protocol: PROTOCOL_VERSION, type: "fixtureValues", values: this.pendingValues });
            countValuesPosted(valueCount);
            this.pendingValues = {};
        }
    }

    private discardPending() {
        if (this.frameHandle !== null) {
            cancelAnimationFrame(this.frameHandle);
            this.frameHandle = null;
        }
        if (this.timeoutHandle !== null) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        }
        this.pendingObjects.clear();
        this.pendingRemoved.clear();
        this.pendingRootOrder = null;
        this.pendingEnvironment = null;
        this.pendingConfigs = {};
        this.pendingValues = {};
    }

    private post(message: MainToShowMessage) {
        this.channel.postMessage(message);
    }
}
