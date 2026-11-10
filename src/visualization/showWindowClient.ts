import { ref } from "vue";
import { v4 as uuidv4 } from "uuid";

import type { CameraPose, CameraPosition, SceneSnapshot } from "@/scene/model/types";
import { CHANNEL_NAME, PROTOCOL_VERSION, isProtocolMessage, type MainToShowMessage, type ShowToMainMessage } from "./protocol";
import type { SceneView } from "./sceneView";

/** Pose a show window starts with: the show default, else the first saved position, else the editor camera. */
export function getInitialCameraPose(scene: SceneSnapshot): CameraPose {
    const cameras = scene.cameras;
    return cameras.find((c) => c.isShowDefault) ?? cameras[0] ?? scene.editorCamera;
}

/** Interval of the heartbeat that keeps this window alive in the main window (research R15). */
const HEARTBEAT_INTERVAL_MS = 2000;

/** Show-window side of protocol v3: applies incoming messages to a `SceneView`. Never changes the scene. */
export class ShowWindowClient {
    public readonly windowId = uuidv4();
    public readonly protocolMismatch = ref(false);
    public readonly cameras = ref<CameraPosition[]>([]);

    private readonly channel = new BroadcastChannel(CHANNEL_NAME);
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private disposed = false;
    private readonly onVisibilityChange = () => this.sendHeartbeat();

    public constructor(private readonly view: SceneView, private readonly onSnapshot: (pose: CameraPose) => void) {
        this.channel.addEventListener("message", (ev: MessageEvent<unknown>) => this.onMessage(ev.data));
    }

    public start() {
        this.post({ protocol: PROTOCOL_VERSION, type: "hello", windowId: this.windowId });
        this.sendHeartbeat();
        this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
        document.addEventListener("visibilitychange", this.onVisibilityChange);
    }

    /** Says `bye` (the main window forgets this window at once) and closes the channel. */
    public dispose() {
        if (this.disposed) {
            return;
        }
        if (this.heartbeatInterval !== null) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            this.post({ protocol: PROTOCOL_VERSION, type: "bye", windowId: this.windowId });
        }
        document.removeEventListener("visibilitychange", this.onVisibilityChange);
        this.disposed = true;
        this.channel.close();
    }

    private sendHeartbeat() {
        this.post({
            protocol: PROTOCOL_VERSION,
            type: "heartbeat",
            windowId: this.windowId,
            visible: document.visibilityState === "visible",
        });
    }

    private post(message: ShowToMainMessage) {
        if (!this.disposed) {
            this.channel.postMessage(message);
        }
    }

    private onMessage(data: unknown) {
        if (!isProtocolMessage(data)) {
            return;
        }
        if (data.protocol !== PROTOCOL_VERSION) {
            this.protocolMismatch.value = true;
            return;
        }
        const message = data as MainToShowMessage;

        switch (message.type) {
            case "snapshot": {
                if (message.target !== this.windowId) {
                    return;
                }
                this.view.setScene(message.scene);
                this.cameras.value = message.scene.cameras;
                for (const [objectId, fixture] of Object.entries(message.fixtures)) {
                    this.view.setFixtureConfig(objectId, fixture.config);
                }
                for (const [objectId, fixture] of Object.entries(message.fixtures)) {
                    this.view.setFixtureValue(objectId, fixture.value);
                }
                this.onSnapshot(getInitialCameraPose(message.scene));
                break;
            }
            case "asset":
                if (message.target === this.windowId || message.target === "*") {
                    this.view.setAsset(message.assetId, new Uint8Array(message.data));
                }
                break;
            case "objectsChanged":
                this.view.applyObjects(message.objects);
                break;
            case "objectsRemoved":
                this.view.removeObjects(message.ids);
                break;
            case "camerasChanged":
                this.cameras.value = message.cameras;
                break;
            case "environmentChanged":
                this.view.setEnvironment(message.environment);
                break;
            case "fixtureConfigs":
                for (const [objectId, config] of Object.entries(message.configs)) {
                    this.view.setFixtureConfig(objectId, config);
                }
                break;
            case "fixtureValues":
                for (const [objectId, value] of Object.entries(message.values)) {
                    this.view.setFixtureValue(objectId, value);
                }
                break;
            case "reset":
                this.view.removeObjects(this.view.getObjectIds());
                this.cameras.value = [];
                break;
        }
    }
}
