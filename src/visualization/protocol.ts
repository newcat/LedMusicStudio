/** Show window protocol v3, see specs/003-rendering-capabilities/contracts/show-window-protocol-v3.md */
import type { CameraPosition, SceneEnvironment, SceneObject, SceneSnapshot } from "@/scene/model/types";

export const CHANNEL_NAME = "lms-visualization";
export const PROTOCOL_VERSION = 3;

export interface FixtureSnapshot {
    config: unknown;
    /** DMX channel values, or flat RGB bytes for LED strips (contract → Value encoding). */
    value: Uint8Array;
}

interface MessageBase<T extends string> {
    protocol: typeof PROTOCOL_VERSION;
    type: T;
}

/** Show -> main */
export interface HelloMessage extends MessageBase<"hello"> {
    windowId: string;
}

/** Show -> main, every 2 s and on `visibilitychange`. */
export interface HeartbeatMessage extends MessageBase<"heartbeat"> {
    windowId: string;
    visible: boolean;
}

/** Show -> main, on `pagehide`. */
export interface ByeMessage extends MessageBase<"bye"> {
    windowId: string;
}

export type ShowToMainMessage = HelloMessage | HeartbeatMessage | ByeMessage;

/** Main -> show */
export interface SnapshotMessage extends MessageBase<"snapshot"> {
    target: string;
    scene: SceneSnapshot;
    fixtures: Record<string, FixtureSnapshot>;
}

export interface AssetMessage extends MessageBase<"asset"> {
    target: string;
    assetId: string;
    mimeType: string;
    data: ArrayBuffer;
}

export interface ObjectsChangedMessage extends MessageBase<"objectsChanged"> {
    objects: SceneObject[];
    rootOrder: string[];
}

export interface ObjectsRemovedMessage extends MessageBase<"objectsRemoved"> {
    ids: string[];
}

export interface CamerasChangedMessage extends MessageBase<"camerasChanged"> {
    cameras: CameraPosition[];
}

export interface EnvironmentChangedMessage extends MessageBase<"environmentChanged"> {
    environment: SceneEnvironment;
}

export interface FixtureConfigsMessage extends MessageBase<"fixtureConfigs"> {
    configs: Record<string, unknown>;
}

/** Only sent while the sink is active (at least one visible show window). */
export interface FixtureValuesMessage extends MessageBase<"fixtureValues"> {
    values: Record<string, Uint8Array>;
}

export type ResetMessage = MessageBase<"reset">;

export type MainToShowMessage =
    | SnapshotMessage
    | AssetMessage
    | ObjectsChangedMessage
    | ObjectsRemovedMessage
    | CamerasChangedMessage
    | EnvironmentChangedMessage
    | FixtureConfigsMessage
    | FixtureValuesMessage
    | ResetMessage;

export type ShowWindowMessage = ShowToMainMessage | MainToShowMessage;

export function isProtocolMessage(data: unknown): data is { protocol: number; type: string } {
    return typeof data === "object" && data !== null && "protocol" in data && "type" in data;
}
