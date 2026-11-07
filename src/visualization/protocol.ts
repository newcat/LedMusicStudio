/** Show window protocol v2, see specs/001-scene-editor/contracts/show-window-protocol.md */
import type { CameraPosition, SceneObject, SceneSnapshot } from "@/scene/model/types";

export const CHANNEL_NAME = "lms-visualization";
export const PROTOCOL_VERSION = 2;

export interface FixtureSnapshot {
    config: unknown;
    value: unknown;
}

interface MessageBase<T extends string> {
    protocol: typeof PROTOCOL_VERSION;
    type: T;
}

/** Show -> main */
export interface HelloMessage extends MessageBase<"hello"> {
    windowId: string;
}

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

export interface FixtureConfigsMessage extends MessageBase<"fixtureConfigs"> {
    configs: Record<string, unknown>;
}

export interface FixtureValuesMessage extends MessageBase<"fixtureValues"> {
    values: Record<string, unknown>;
}

export type ResetMessage = MessageBase<"reset">;

export type MainToShowMessage =
    | SnapshotMessage
    | AssetMessage
    | ObjectsChangedMessage
    | ObjectsRemovedMessage
    | CamerasChangedMessage
    | FixtureConfigsMessage
    | FixtureValuesMessage
    | ResetMessage;

export type ShowWindowMessage = HelloMessage | MainToShowMessage;

export function isProtocolMessage(data: unknown): data is { protocol: number; type: string } {
    return typeof data === "object" && data !== null && "protocol" in data && "type" in data;
}
