/**
 * Per-view cache of asset templates (feature 002, research R6). One instance per SceneView.
 * Templates are built once per key, get LED-lit materials per slot and are reference-counted by user id.
 * Instances are made with `instantiate(template)`, which shares geometry and materials.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { convertToLedLit, createLedLitMaterial, type LedStripLighting } from "@/visualization/ledLitMaterial";
import { builderKit } from "./builders/kit";
import { assetCatalog } from "./catalog";
import { resolveSlotStyle, type SlotStyleOptions } from "./materials";
import { completeParams } from "./params";
import type { AssetCatalog, AssetDefinition, MaterialPresetId, ParamValues } from "./types";

export interface TemplateSpec {
    assetId: string;
    params?: ParamValues | null;
    variant?: string | null;
    material?: MaterialPresetId | null;
    color?: string | null;
}

/** Cache key; params are sorted by key so equal parameter sets give equal keys. */
export function templateKey(
    assetId: string,
    params: ParamValues | null | undefined,
    variant: string | null | undefined,
    material: MaterialPresetId | null | undefined,
    color: string | null | undefined,
): string {
    const entries = Object.entries(params ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const paramsKey = entries.map(([k, v]) => `${k}=${v}`).join(",");
    return `${assetId}|${paramsKey}|${variant ?? ""}|${material ?? ""}|${color ?? ""}`;
}

export function templateKeyOf(spec: TemplateSpec): string {
    return templateKey(spec.assetId, spec.params, spec.variant, spec.material, spec.color);
}

/** A clone that shares geometry and materials with the template. */
export function instantiate(template: THREE.Object3D): THREE.Object3D {
    const clone = template.clone(true);
    clone.userData.sharedResources = true;
    return clone;
}

interface CacheEntry {
    users: Set<string>;
    promise: Promise<THREE.Object3D | null>;
    template: THREE.Object3D | null;
    ready: boolean;
}

function forEachMaterial(mesh: THREE.Mesh, fn: (m: THREE.Material) => void) {
    if (Array.isArray(mesh.material)) {
        mesh.material.forEach(fn);
    } else {
        fn(mesh.material);
    }
}

function disposeTemplate(template: THREE.Object3D) {
    const materials = new Set<THREE.Material>();
    template.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            forEachMaterial(child, (m) => materials.add(m));
        }
    });
    materials.forEach((m) => m.dispose());
}

function hasTexture(material: THREE.Material): boolean {
    return material instanceof THREE.MeshStandardMaterial && material.map !== null;
}

export class AssetCache {
    private readonly entries = new Map<string, CacheEntry>();
    private readonly glbScenes = new Map<string, Promise<THREE.Group>>();
    private disposed = false;

    public constructor(
        private readonly lighting: LedStripLighting,
        private readonly catalog: AssetCatalog = assetCatalog,
    ) {}

    public acquire(spec: TemplateSpec, userId: string): Promise<THREE.Object3D | null> {
        const key = templateKeyOf(spec);
        let entry = this.entries.get(key);
        if (!entry) {
            const created: CacheEntry = { users: new Set(), promise: Promise.resolve(null), template: null, ready: false };
            created.promise = this.build(spec).then((template) => {
                if (this.disposed || this.entries.get(key) !== created) {
                    if (template) {
                        disposeTemplate(template);
                    }
                    return null;
                }
                created.template = template;
                created.ready = true;
                return template;
            });
            this.entries.set(key, created);
            entry = created;
        }
        entry.users.add(userId);
        return entry.promise;
    }

    public release(key: string, userId: string) {
        const entry = this.entries.get(key);
        if (!entry) {
            return;
        }
        entry.users.delete(userId);
        if (entry.users.size > 0) {
            return;
        }
        this.entries.delete(key);
        if (entry.template) {
            disposeTemplate(entry.template);
            entry.template = null;
        }
    }

    /** A ready template, or `undefined` while loading, after a failed load or if the key is not cached. */
    public getSync(key: string): THREE.Object3D | undefined {
        const entry = this.entries.get(key);
        return entry?.ready && entry.template ? entry.template : undefined;
    }

    public dispose() {
        this.disposed = true;
        for (const entry of this.entries.values()) {
            if (entry.template) {
                disposeTemplate(entry.template);
            }
        }
        this.entries.clear();
        for (const promise of this.glbScenes.values()) {
            void promise.then(
                (scene) => {
                    const textures = new Set<THREE.Texture>();
                    scene.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.geometry.dispose();
                            forEachMaterial(child, (m) => {
                                for (const value of Object.values(m)) {
                                    if (value instanceof THREE.Texture) {
                                        textures.add(value);
                                    }
                                }
                                m.dispose();
                            });
                        }
                    });
                    textures.forEach((t) => t.dispose());
                },
                () => undefined,
            );
        }
        this.glbScenes.clear();
    }

    private async build(spec: TemplateSpec): Promise<THREE.Object3D | null> {
        const definition = this.catalog.get(spec.assetId);
        if (!definition) {
            console.error(`[asset-library] unknown asset "${spec.assetId}"`);
            return null;
        }
        const options: SlotStyleOptions = { material: spec.material, color: spec.color, variant: spec.variant };
        try {
            const source = definition.source;
            if (source.type === "procedural" || source.type === "parametric") {
                const template =
                    source.type === "procedural" ? source.build(builderKit) : source.build(completeParams(definition, spec.params), builderKit);
                this.applyBuilderMaterials(definition, template, options);
                return template;
            }
            if (source.type === "glb") {
                const scene = await this.loadGlb(source.file);
                const template = scene.clone(true);
                template.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry = child.geometry.clone();
                    }
                });
                this.applyGlbMaterials(definition, template, options);
                return template;
            }
            console.error(`[asset-library] asset "${spec.assetId}" has a source that the asset cache does not build`);
            return null;
        } catch (err) {
            console.error(`[asset-library] could not build asset "${spec.assetId}"`, err);
            return null;
        }
    }

    private loadGlb(file: string): Promise<THREE.Group> {
        let promise = this.glbScenes.get(file);
        if (!promise) {
            promise = (async () => {
                const response = await fetch(file);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} for ${file}`);
                }
                const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "");
                return gltf.scene;
            })();
            // a failed file may be retried after all of its templates were released
            promise.catch(() => this.glbScenes.delete(file));
            this.glbScenes.set(file, promise);
        }
        return promise;
    }

    private slotMaterial(definition: AssetDefinition, slot: string, options: SlotStyleOptions, cache: Map<string, THREE.Material>) {
        let material = cache.get(slot);
        if (!material) {
            const style = resolveSlotStyle(definition, slot, options);
            material = createLedLitMaterial(this.lighting, {
                color: style.color,
                roughness: style.roughness,
                metalness: style.metalness,
                sheen: style.sheen,
                clearcoat: style.clearcoat,
                specularIntensity: style.specularIntensity,
            });
            cache.set(slot, material);
        }
        return material;
    }

    private applyBuilderMaterials(definition: AssetDefinition, template: THREE.Object3D, options: SlotStyleOptions) {
        const perSlot = new Map<string, THREE.Material>();
        template.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) {
                return;
            }
            const slot: string = child.userData.slot ?? "body";
            child.userData.slot = slot;
            forEachMaterial(child, (m) => m.dispose());
            child.material = this.slotMaterial(definition, slot, options, perSlot);
        });
    }

    private applyGlbMaterials(definition: AssetDefinition, template: THREE.Object3D, options: SlotStyleOptions) {
        const perSlot = new Map<string, THREE.Material>();
        const converted = new Map<THREE.Material, THREE.Material>();
        const replace = (original: THREE.Material): THREE.Material => {
            const slot = original.name || "body";
            if (!hasTexture(original)) {
                return this.slotMaterial(definition, slot, options, perSlot);
            }
            let material = converted.get(original);
            if (!material) {
                material = convertToLedLit(this.lighting, original);
                const recolor = Boolean(
                    (options.variant && definition.variants?.find((v) => v.id === options.variant)?.slots[slot]) ||
                        (slot === "body" && (options.color || options.material)),
                );
                if (recolor && "color" in material && material.color instanceof THREE.Color) {
                    material.color.set(resolveSlotStyle(definition, slot, options).color);
                }
                converted.set(original, material);
            }
            return material;
        };
        template.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) {
                return;
            }
            const first = Array.isArray(child.material) ? child.material[0] : child.material;
            child.userData.slot = first?.name || "body";
            child.material = Array.isArray(child.material) ? child.material.map(replace) : replace(child.material);
        });
    }
}
