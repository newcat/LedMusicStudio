import type { PersistedSceneState, SceneAsset, SceneAssetPersisted, SceneObject } from "./types";
import { isImportedModel } from "./types";

const CHUNK = 0x8000;

/** Chunked so that 50 MB inputs do not overflow the call stack. */
export function uint8ToBase64(data: Uint8Array): string {
    const parts: string[] = [];
    for (let i = 0; i < data.length; i += CHUNK) {
        parts.push(String.fromCharCode(...data.subarray(i, i + CHUNK)));
    }
    return btoa(parts.join(""));
}

export function base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64);
    const result = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        result[i] = binary.charCodeAt(i);
    }
    return result;
}

export function serializeAssets(assets: Record<string, SceneAsset>, keep?: Set<string>): PersistedSceneState["assets"] {
    const result: Record<string, SceneAssetPersisted> = {};
    for (const [id, asset] of Object.entries(assets)) {
        if (keep && !keep.has(id)) {
            continue;
        }
        result[id] = { id: asset.id, name: asset.name, mimeType: asset.mimeType, data: uint8ToBase64(asset.data) };
    }
    return result;
}

/** Corrupt assets are skipped and reported in `problems`. */
export function deserializeAssets(persisted: unknown): { assets: Record<string, SceneAsset>; problems: string[] } {
    const assets: Record<string, SceneAsset> = {};
    const problems: string[] = [];
    if (typeof persisted !== "object" || persisted === null) {
        return { assets, problems };
    }
    for (const [id, raw] of Object.entries(persisted as Record<string, Partial<SceneAssetPersisted>>)) {
        try {
            if (!raw || typeof raw.data !== "string") {
                throw new Error("missing data");
            }
            assets[id] = {
                id,
                name: typeof raw.name === "string" ? raw.name : "model.glb",
                mimeType: "model/gltf-binary",
                data: base64ToUint8(raw.data),
            };
        } catch {
            problems.push(`Asset ${id} is corrupt`);
        }
    }
    return { assets, problems };
}

export function collectReferencedAssetIds(objects: Iterable<SceneObject>): Set<string> {
    const ids = new Set<string>();
    for (const obj of objects) {
        if (isImportedModel(obj)) {
            ids.add(obj.assetId);
        }
    }
    return ids;
}
