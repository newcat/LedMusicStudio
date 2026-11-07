import type { SceneView } from "@/visualization/sceneView";
import {
    CHANNEL_NAME,
    PROTOCOL_VERSION,
    isProtocolMessage,
    type FixtureSnapshot,
    type MainToShowMessage,
    type ShowWindowMessage,
} from "@/visualization/protocol";
import type { CameraPosition, SceneAsset, SceneObject, SceneState } from "./model/types";

/**
 * Receives every change of the scene. The embedded editor's view and the show windows are sinks.
 * Objects handed to a sink are plain (non-reactive) data and must not be modified by the sink.
 */
export interface SceneSink {
    reset(scene: SceneState): void;
    objectsChanged(objects: SceneObject[], rootOrder: string[]): void;
    objectsRemoved(ids: string[]): void;
    asset(id: string, mimeType: string, data: Uint8Array): void;
    camerasChanged(cameras: CameraPosition[]): void;
    fixtureConfigs(configs: Record<string, unknown>): void;
    fixtureValues(values: Record<string, unknown>): void;
}

/** Forwards to a `SceneView` in the same window. */
export class LocalSceneSink implements SceneSink {
    public constructor(private readonly view: SceneView) {}

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

    public fixtureValues(values: Record<string, unknown>) {
        for (const [id, value] of Object.entries(values)) {
            this.view.setFixtureValue(id, value);
        }
    }
}

export interface BroadcastSceneSinkProvider {
    getScene(): SceneState;
    getFixtures(): Record<string, FixtureSnapshot>;
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

/** Main-window side of the show window protocol (contracts/show-window-protocol.md). */
export class BroadcastSceneSink implements SceneSink {
    private readonly channel = new BroadcastChannel(CHANNEL_NAME);
    private readonly knownWindows = new Set<string>();

    private pendingObjects = new Map<string, SceneObject>();
    private pendingRootOrder: string[] | null = null;
    private pendingRemoved = new Set<string>();
    private pendingConfigs: Record<string, unknown> = {};
    private pendingValues: Record<string, unknown> = {};
    private frameHandle: number | null = null;
    private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    public constructor(private readonly provider: BroadcastSceneSinkProvider) {
        this.channel.addEventListener("message", (ev: MessageEvent<unknown>) => {
            const data = ev.data as ShowWindowMessage;
            if (!isProtocolMessage(data) || data.protocol !== PROTOCOL_VERSION) {
                return;
            }
            if (data.type === "hello") {
                this.knownWindows.add(data.windowId);
                this.sendSnapshot(data.windowId);
            }
        });
    }

    public get windowCount() {
        return this.knownWindows.size;
    }

    public reset() {
        this.discardPending();
        this.post({ protocol: PROTOCOL_VERSION, type: "reset" });
        for (const windowId of this.knownWindows) {
            this.sendSnapshot(windowId);
        }
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

    public fixtureValues(values: Record<string, unknown>) {
        Object.assign(this.pendingValues, values);
        this.schedule();
    }

    public dispose() {
        this.discardPending();
        this.channel.close();
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
        if (Object.keys(this.pendingConfigs).length > 0) {
            this.post({ protocol: PROTOCOL_VERSION, type: "fixtureConfigs", configs: this.pendingConfigs });
            this.pendingConfigs = {};
        }
        if (Object.keys(this.pendingValues).length > 0) {
            this.post({ protocol: PROTOCOL_VERSION, type: "fixtureValues", values: this.pendingValues });
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
        this.pendingConfigs = {};
        this.pendingValues = {};
    }

    private post(message: MainToShowMessage) {
        this.channel.postMessage(message);
    }
}
