import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { v4 as uuidv4 } from "uuid";

import { getNativeAdapter } from "@/native";
import type { SceneAsset } from "../model/types";
import type { useScene } from "../sceneStore";
import { emitSceneToast } from "../toastBus";

type SceneStore = ReturnType<typeof useScene>;

const LARGE_FILE_BYTES = 20 * 1024 * 1024;
const MAX_SIDE_METERS = 50;
const MIN_SIDE_METERS = 0.01;
const TARGET_SIDE_METERS = 10;
/** "glTF" */
const GLB_MAGIC = 0x46546c67;

function fail(reason: string) {
    emitSceneToast({ severity: "error", summary: "Import failed", detail: `Could not import model: ${reason}`, life: 6000 });
}

function baseName(path: string): string {
    return path.split(/[\\/]/).pop() || "model.glb";
}

function disposeScene(root: THREE.Object3D) {
    root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
                for (const value of Object.values(material)) {
                    if (value instanceof THREE.Texture) value.dispose();
                }
                material.dispose();
            }
        }
    });
}

/**
 * Lets the user pick a GLB file and adds it to the scene as one object (research R10). On any error the scene is left
 * unchanged (FR-037).
 */
export async function importModelFile(store: SceneStore, placement?: { point: [number, number, number]; normal: [number, number, number] } | null) {
    let result;
    try {
        result = await getNativeAdapter().chooseAndReadFile({ accept: [{ name: "3D Model (GLB)", extensions: ["glb"] }] });
    } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
        return;
    }
    if (!result) {
        return;
    }

    const data = result.data;
    if (data.byteLength >= LARGE_FILE_BYTES) {
        const megabytes = (data.byteLength / 1024 / 1024).toFixed(1);
        if (!window.confirm(`This model is ${megabytes} MB and will be stored in the project file, making it larger. Continue?`)) {
            return;
        }
    }

    // .gltf JSON files with external references are rejected
    if (data.byteLength < 12 || new DataView(data.buffer, data.byteOffset, 4).getUint32(0, true) !== GLB_MAGIC) {
        fail("the file is not a binary glTF (.glb). Models with external files are not supported.");
        return;
    }

    let factor = 1;
    try {
        const copy = data.slice();
        const gltf = await new GLTFLoader().parseAsync(copy.buffer, "");
        const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
        const largest = Math.max(size.x, size.y, size.z);
        disposeScene(gltf.scene);
        if (!Number.isFinite(largest) || largest <= 0) {
            fail("the model contains no geometry.");
            return;
        }
        if (largest > MAX_SIDE_METERS || largest < MIN_SIDE_METERS) {
            factor = TARGET_SIDE_METERS / largest;
        }
    } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
        return;
    }

    const fileName = baseName(result.path);
    const asset: SceneAsset = { id: uuidv4(), name: fileName, mimeType: "model/gltf-binary", data: data.slice() };
    store.addImportedModel(asset, fileName.replace(/\.glb$/i, ""), factor, placement);

    if (factor !== 1) {
        emitSceneToast({
            severity: "info",
            summary: "Model scaled",
            detail: `Model was scaled to fit (factor ${Number(factor.toPrecision(3))}). Use 'Restore original scale' in the inspector to undo.`,
            life: 8000,
        });
    }
}
