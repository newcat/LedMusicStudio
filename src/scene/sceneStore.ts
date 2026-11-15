import { computed, markRaw, ref, shallowRef, toRaw } from "vue";
import { defineStore } from "pinia";

import { useStage } from "@/stage/stage";
import { FixtureType, type FixtureSnapshot } from "@/stage/fixtures/base.fixture";
import { createFixture } from "@/stage/fixtures/factory";
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { getVisualizationByType } from "@/visualization/fixtureVisualizations/factory";
import { assetCatalog } from "@/assetLibrary/catalog";
import { isMaterialPresetId, MATERIAL_PRESETS } from "@/assetLibrary/materials";
import { completeParams, sizeOf } from "@/assetLibrary/params";
import type { MaterialPresetId, ParamValues } from "@/assetLibrary/types";
import { collectReferencedAssetIds, serializeAssets } from "./model/assets";
import {
    createDefaultScene,
    createFixtureVisualizationObject,
    createGroupObject,
    createAimTargetObject,
    createImportedModelObject,
    createLibraryAssetObject,
    createShapeObject,
    isParametricLibraryAsset,
    MODEL_SCALE_MAX,
    MODEL_SCALE_MIN,
    nextObjectName,
    SHAPE_LABELS,
} from "./model/defaults";
import {
    applyObjectStates,
    cloneObject,
    cloneStates,
    mergeFixtureStates,
    MERGE_WINDOW_MS,
    SceneHistory,
    type FixtureStates,
} from "./model/history";
import {
    alignToActive,
    distributeEvenly,
    getDescendantIds,
    getSelectionRoots,
    isEffectivelyVisible,
    MIN_SCALE,
    reparentKeepingWorld,
    toMatrix,
    worldToLocal,
    wouldCreateCycle,
    type Axis,
    type LocalTransform,
} from "./model/transformMath";
import type { SceneSink } from "./sceneSink";
import {
    compatibleVisualizationTypes,
    DEFAULT_DMX_VISUALIZATION,
    hasPlausibleDimensions,
    modelForType,
    modelScaleForFixture,
    preselectionOf,
    usesDefaultModel,
    withModelRanges,
} from "./fixtureModels";
import type { CapabilityMapping } from "@/visualization/capabilities/types";
import type {
    CameraPose,
    FixtureVisualizationModelFields,
    FixtureVisualizationObject,
    PersistedSceneState,
    SceneAsset,
    SceneEditorSettings,
    SceneEnvironment,
    SceneObject,
    SceneState,
    ShapeType,
    Vec3,
} from "./model/types";
import { sanitizeEnvironment, validateStripPath } from "./model/sanitize";
import type { LedStripVisualizationConfig, StripPath } from "@/visualization/fixtureVisualizations/ledStrip/types";
import { stripPathLedCount } from "@/visualization/fixtureVisualizations/ledStrip/stripPath";
import { isFixtureVisualization, isLibraryAsset, isShape } from "./model/types";

export type TransformMode = "translate" | "rotate" | "scale";
export type SelectMode = "replace" | "toggle" | "add";
export type ObjectStates = Record<string, SceneObject | null>;
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

interface Clipboard {
    /** states of the copied subtrees, parent links inside the copy are kept */
    objects: SceneObject[];
    rootIds: string[];
    /** feature 006: snapshots of the fixtures of all copied fixture objects, keyed by source fixture id */
    fixtures: Record<string, FixtureSnapshot>;
}

function unique<T>(values: Iterable<T>): T[] {
    return [...new Set(values)];
}

function clampPatch(patch: Partial<SceneObject>): Partial<SceneObject> {
    const result: Record<string, unknown> = { ...patch };
    if (patch.scale) {
        result.scale = patch.scale.map((s) => Math.max(MIN_SCALE, Number.isFinite(s) ? s : 1));
    }
    if ("dimensions" in patch && patch.dimensions && typeof patch.dimensions === "object") {
        result.dimensions = Object.fromEntries(
            Object.entries(patch.dimensions as Record<string, number>).map(([k, v]) => [k, Math.max(0.01, Number.isFinite(v) ? v : 1)])
        );
    }
    if ("modelScale" in patch && typeof patch.modelScale === "number") {
        result.modelScale = Math.min(MODEL_SCALE_MAX, Math.max(MODEL_SCALE_MIN, Number.isFinite(patch.modelScale) ? patch.modelScale : 1));
    }
    if ("size" in patch && Array.isArray(patch.size)) {
        result.size = patch.size.map((v) => Math.max(0.01, Number.isFinite(v) ? v : 0.01));
    }
    if (typeof patch.name === "string") {
        if (patch.name.trim().length === 0) {
            delete result.name;
        } else {
            result.name = patch.name.trim();
        }
    }
    return result as Partial<SceneObject>;
}

/** Options of the library add commands (snapping, T082): parent and world transform of the new object. */
export interface AddAssetOptions {
    parentId?: string | null;
    worldTransform?: { position: Vec3; rotation: Vec3; scale?: Vec3 };
}

/** Surface point (and normal) a new object is placed on; null/undefined = scene origin. */
export type Placement = { point: Vec3; normal: Vec3 } | null | undefined;

/** Options of `addFixture` (feature 006, contracts/fixture-commands.md). */
export interface AddFixtureOptions extends AddAssetOptions {
    placement?: Placement;
    /** model of the fixture object; its first visualization type compatible with the fixture type is used */
    modelId?: string;
    visualizationType?: VisualizationType;
    /** name of fixture and object, default "DMX fixture N" / "LED strip N" */
    name?: string;
    /** history label, default "Add DMX fixture" / "Add LED strip" */
    label?: string;
}

/** Patch of `updateFixture` (feature 006). */
export interface FixturePatch {
    name?: string;
    config?: object;
    controllerId?: string | null;
}

/** Profile fields of a DMX fixture config, compared by `updateFixture` (research R8). */
interface DmxProfileFields {
    definition?: unknown;
    mode?: unknown;
}

/** "Spot 1" -> "Spot", for naming copies with the next free number (research R6). */
function baseNameOf(name: string): string {
    return name.replace(/\s+\d+$/, "") || name;
}

export const useScene = defineStore("scene", () => {
    const scene = ref<SceneState>(createDefaultScene());
    const selection = ref<string[]>([]);
    const transformMode = ref<TransformMode>("translate");
    const clipboard = shallowRef<Clipboard | null>(null);
    const history = markRaw(new SceneHistory());
    const historyVersion = ref(0);
    const sinks = markRaw(new Set<SceneSink>());
    /** Hooks called for every registered sink; they may return a cleanup that runs when the sink is unregistered. */
    type SinkHook = (sink: SceneSink) => (() => void) | undefined;
    const sinkHooks = markRaw(new Set<SinkHook>());
    const sinkCleanups = markRaw(new Map<SceneSink, Array<() => void>>());

    const canUndo = computed(() => (historyVersion.value, history.canUndo));
    const canRedo = computed(() => (historyVersion.value, history.canRedo));
    const activeId = computed(() => selection.value[selection.value.length - 1] ?? null);

    // -----------------------------------------------------------------------------------------------------------
    // helpers

    function rawScene(): SceneState {
        return toRaw(scene.value);
    }

    function rawObject(id: string): SceneObject | undefined {
        return rawScene().objects[id];
    }

    function bumpHistory() {
        historyVersion.value++;
    }

    function captureStates(ids: Iterable<string>): ObjectStates {
        const result: ObjectStates = {};
        for (const id of ids) {
            const obj = rawObject(id);
            result[id] = obj ? cloneObject(obj) : null;
        }
        return result;
    }

    function notifyStates(ids: Iterable<string>) {
        const changed: SceneObject[] = [];
        const removed: string[] = [];
        for (const id of ids) {
            const obj = rawObject(id);
            if (obj) {
                changed.push(obj);
            } else {
                removed.push(id);
            }
        }
        if (removed.length > 0) {
            for (const sink of sinks) sink.objectsRemoved(removed);
        }
        if (changed.length > 0) {
            const rootOrder = [...rawScene().rootOrder];
            for (const sink of sinks) sink.objectsChanged(changed, rootOrder);
        }
    }

    function pruneSelection() {
        const filtered = selection.value.filter((id) => scene.value.objects[id]);
        if (filtered.length !== selection.value.length) {
            selection.value = filtered;
        }
    }

    function siblingsOf(parentId: string | null): string[] {
        return parentId ? scene.value.objects[parentId].children : scene.value.rootOrder;
    }

    function captureFixtures(ids: Iterable<string>): FixtureStates {
        const stage = useStage();
        const result: FixtureStates = {};
        for (const id of ids) {
            result[id] = stage.snapshotFixture(id);
        }
        return result;
    }

    /**
     * Runs a mutation as one history entry. `affected` lists every object that exists before the mutation and may be
     * changed by it (including parents whose `children` change); `options.fixtures` lists existing fixtures the
     * mutation may change or delete (feature 006). `mutate` returns the ids of newly created objects (`string[]`), or
     * `{ objects, fixtures }` with the ids of newly created objects and fixtures.
     */
    function runCommand(
        label: string,
        affected: Iterable<string>,
        mutate: () => unknown,
        recordHistory = true,
        mergeKey?: string,
        options?: { fixtures?: Iterable<string> }
    ) {
        const stage = useStage();
        const affectedIds = unique(affected).filter((id) => rawObject(id));
        const before = captureStates(affectedIds);
        const affectedFixtures = unique(options?.fixtures ?? []).filter((id) => stage.fixtures.has(id));
        const fixturesBefore = captureFixtures(affectedFixtures);
        const rootOrderBefore = [...rawScene().rootOrder];
        const environmentBefore = rawScene().environment;
        const result = mutate();
        // commands replace the environment object instead of mutating it, so a reference check finds changes
        const environmentChanged = rawScene().environment !== environmentBefore;
        const environmentAfter = rawScene().environment;
        let created: string[] = [];
        let createdFixtures: string[] = [];
        if (Array.isArray(result)) {
            created = result as string[];
        } else if (result && typeof result === "object") {
            const r = result as { objects?: string[]; fixtures?: string[] };
            created = r.objects ?? [];
            createdFixtures = r.fixtures ?? [];
        }
        for (const id of created) {
            if (!(id in before)) {
                before[id] = null;
            }
        }
        for (const id of createdFixtures) {
            if (!(id in fixturesBefore)) {
                fixturesBefore[id] = null;
            }
        }
        const allIds = unique([...affectedIds, ...created]);
        const allFixtures = unique([...affectedFixtures, ...createdFixtures]);
        const fixturesChanged = allFixtures.length > 0;
        if (recordHistory) {
            const now = Date.now();
            const top = history.top;
            const fixturesAfter = fixturesChanged ? captureFixtures(allFixtures) : undefined;
            if (mergeKey && top && top.mergeKey === mergeKey && top.time !== undefined && now - top.time < MERGE_WINDOW_MS) {
                for (const [id, state] of Object.entries(before)) {
                    if (!(id in top.before)) {
                        top.before[id] = state;
                    }
                }
                top.after = { ...top.after, ...captureStates(allIds) };
                top.rootOrderAfter = [...rawScene().rootOrder];
                if (environmentChanged) {
                    top.environmentBefore ??= structuredClone(environmentBefore);
                    top.environmentAfter = structuredClone(environmentAfter);
                }
                if (fixturesAfter) {
                    top.fixturesBefore = mergeFixtureStates(top.fixturesBefore, fixturesBefore, "older");
                    top.fixturesAfter = mergeFixtureStates(top.fixturesAfter, fixturesAfter, "newer");
                }
                top.time = now;
            } else {
                history.push({
                    label,
                    before,
                    after: captureStates(allIds),
                    rootOrderBefore,
                    rootOrderAfter: [...rawScene().rootOrder],
                    ...(environmentChanged
                        ? { environmentBefore: structuredClone(environmentBefore), environmentAfter: structuredClone(environmentAfter) }
                        : {}),
                    ...(fixturesAfter ? { fixturesBefore, fixturesAfter } : {}),
                    mergeKey,
                    time: now,
                });
            }
            bumpHistory();
        }
        notifyStates(allIds);
        if (environmentChanged) {
            notifyEnvironment();
        }
        pruneSelection();
    }

    function notifyEnvironment() {
        const environment = rawScene().environment;
        for (const sink of sinks) sink.environmentChanged(environment);
    }

    /**
     * Changes haze, hazer coupling or ambient light (feature 003, data-model §4). Undoable; repeated changes with the
     * same `coalesceKey` (e.g. a slider drag) become one history entry.
     */
    function setEnvironment(patch: DeepPartial<SceneEnvironment>, coalesceKey?: string) {
        const current = rawScene().environment;
        const next = sanitizeEnvironment({
            ...current,
            ...patch,
            ambient: {
                editor: { ...current.ambient.editor, ...patch.ambient?.editor },
                show: { ...current.ambient.show, ...patch.ambient?.show },
            },
        });
        if (JSON.stringify(next) === JSON.stringify(current)) {
            return;
        }
        const keys = Object.keys(patch);
        const label = keys.length === 1 && keys[0] === "haze" ? "Set haze" : "Change environment";
        runCommand(
            label,
            [],
            () => {
                scene.value.environment = next;
            },
            true,
            coalesceKey
        );
    }

    function parentsOf(ids: Iterable<string>): string[] {
        const result: string[] = [];
        for (const id of ids) {
            const parent = rawObject(id)?.parentId;
            if (parent) result.push(parent);
        }
        return result;
    }

    // -----------------------------------------------------------------------------------------------------------
    // commands

    /**
     * Adds objects. Objects whose `parentId` is not part of the batch become children of `parentId` (root if null).
     * `children` of the given objects are rebuilt from the batch.
     */
    function addObjects(objects: SceneObject[], parentId?: string | null, label = "Add", fixtures: Record<string, FixtureSnapshot> = {}) {
        if (objects.length === 0) {
            return [];
        }
        const stage = useStage();
        const batchIds = new Set(objects.map((o) => o.id));
        const rootsOfBatch = objects.filter((o) => !o.parentId || !batchIds.has(o.parentId));
        const targetParentOf = (obj: SceneObject): string | null => {
            const wanted = parentId !== undefined ? parentId : obj.parentId;
            return wanted && scene.value.objects[wanted] ? wanted : null;
        };
        const affectedParents = rootsOfBatch.map(targetParentOf).filter((p): p is string => p !== null);
        runCommand(label, affectedParents, () => {
            // fixtures first, so the visualization server finds them for the new objects
            for (const [fixtureId, snapshot] of Object.entries(fixtures)) {
                stage.applyFixtureSnapshot(fixtureId, snapshot);
            }
            for (const obj of objects) {
                const copy = cloneObject(obj);
                copy.children = [];
                if (rootsOfBatch.includes(obj)) {
                    copy.parentId = targetParentOf(obj);
                }
                scene.value.objects[copy.id] = copy;
            }
            for (const obj of objects) {
                const copy = scene.value.objects[obj.id];
                siblingsOf(copy.parentId).push(copy.id);
            }
            return { objects: objects.map((o) => o.id), fixtures: Object.keys(fixtures) };
        });
        return objects.map((o) => o.id);
    }

    function applyPatches(patches: Record<string, Partial<SceneObject>>, recordHistory: boolean, label: string, mergeKey?: string) {
        const ids = Object.keys(patches).filter((id) => scene.value.objects[id]);
        if (ids.length === 0) {
            return;
        }
        runCommand(
            label,
            ids,
            () => {
                for (const id of ids) {
                    const patch = clampPatch(patches[id]);
                    // never change identity or hierarchy through a patch
                    for (const key of ["id", "kind", "parentId", "children"]) {
                        Reflect.deleteProperty(patch, key);
                    }
                    // parametric library assets are resized through their parameters, never scaled (T078)
                    if (patch.scale && !("assetId" in patch) && isParametricLibraryAsset(scene.value.objects[id])) {
                        delete patch.scale;
                    }
                    Object.assign(scene.value.objects[id], structuredClone(toRaw(patch)));
                }
            },
            recordHistory,
            mergeKey
        );
    }

    /** `mergeKey`: rapid consecutive edits with the same key become one history entry (typing in a field). */
    function updateObjects(patches: Record<string, Partial<SceneObject>>, label = "Edit", mergeKey?: string) {
        applyPatches(patches, true, label, mergeKey);
    }

    function removeObjects(ids: string[], recordHistory = true, label = "Delete") {
        const existing = ids.filter((id) => scene.value.objects[id]);
        const all = unique(existing.flatMap((id) => [id, ...getDescendantIds(rawScene(), id)]));
        if (all.length === 0) {
            return;
        }
        const removedSet = new Set(all);
        const roots = all.filter((id) => !removedSet.has(rawObject(id)!.parentId ?? ""));
        // FR-004: deleting a fixture object deletes its fixture in the same entry
        const stage = useStage();
        const fixtureIds = unique(
            all.map((id) => rawObject(id)).flatMap((obj) => (obj && isFixtureVisualization(obj) && obj.fixtureId ? [obj.fixtureId] : []))
        );
        runCommand(
            label,
            [...all, ...parentsOf(roots)],
            () => {
                for (const id of roots) {
                    const siblings = siblingsOf(scene.value.objects[id].parentId);
                    const index = siblings.indexOf(id);
                    if (index !== -1) siblings.splice(index, 1);
                }
                for (const id of all) {
                    Reflect.deleteProperty(scene.value.objects, id);
                }
                for (const fixtureId of fixtureIds) {
                    stage.applyFixtureSnapshot(fixtureId, null);
                }
            },
            recordHistory,
            undefined,
            { fixtures: fixtureIds }
        );
    }

    function reparent(ids: string[], newParentId: string | null, index?: number) {
        const roots = getSelectionRoots(rawScene(), ids).filter((id) => scene.value.objects[id] && !wouldCreateCycle(rawScene(), id, newParentId));
        if (roots.length === 0 || (newParentId && !scene.value.objects[newParentId])) {
            return;
        }
        runCommand("Reparent", [...roots, ...parentsOf(roots), ...(newParentId ? [newParentId] : [])], () => moveToParent(roots, newParentId, index));
    }

    /** Moves `roots` (validated) under `newParentId`, keeping their world transforms. No history entry. */
    function moveToParent(roots: string[], newParentId: string | null, index?: number) {
        // transforms are computed on the unchanged scene
        const transforms = new Map<string, LocalTransform>(roots.map((id) => [id, reparentKeepingWorld(rawScene(), id, newParentId)]));
        const siblings = siblingsOf(newParentId);
        let insertAt = index ?? siblings.length;
        for (const id of roots) {
            const obj = scene.value.objects[id];
            const oldSiblings = siblingsOf(obj.parentId);
            const oldIndex = oldSiblings.indexOf(id);
            if (oldIndex !== -1) {
                oldSiblings.splice(oldIndex, 1);
                if (oldSiblings === siblings && oldIndex < insertAt) {
                    insertAt--;
                }
            }
        }
        for (const id of roots) {
            const obj = scene.value.objects[id];
            const t = transforms.get(id)!;
            obj.parentId = newParentId;
            obj.position = t.position;
            obj.rotation = t.rotation;
            obj.scale = t.scale;
            siblings.splice(Math.min(insertAt, siblings.length), 0, id);
            insertAt++;
        }
    }

    function setVisible(ids: string[], visible: boolean) {
        updateObjects(Object.fromEntries(ids.map((id) => [id, { visible }])), visible ? "Show" : "Hide");
    }

    function setLocked(ids: string[], locked: boolean) {
        updateObjects(Object.fromEntries(ids.map((id) => [id, { locked }])), locked ? "Lock" : "Unlock");
    }

    /** Renames an object; a fixture object's fixture gets the same name in the same entry (data-model I2). */
    function rename(id: string, name: string) {
        const trimmed = name.trim();
        const obj = rawObject(id);
        if (!obj || trimmed.length === 0 || obj.name === trimmed) {
            return;
        }
        const stage = useStage();
        const fixtureId = isFixtureVisualization(obj) && obj.fixtureId && stage.fixtures.has(obj.fixtureId) ? obj.fixtureId : null;
        runCommand(
            "Rename",
            [id],
            () => {
                scene.value.objects[id].name = trimmed;
                if (fixtureId) {
                    stage.fixtures.get(fixtureId)!.name = trimmed;
                }
            },
            true,
            undefined,
            { fixtures: fixtureId ? [fixtureId] : [] }
        );
    }

    // fixture visualizations ---------------------------------------------------------------------------------

    function findObjectByFixture(fixtureId: string): FixtureVisualizationObject | undefined {
        // reads the reactive state so that computed properties in components update
        return Object.values(scene.value.objects).find((o): o is FixtureVisualizationObject => isFixtureVisualization(o) && o.fixtureId === fixtureId);
    }

    /**
     * Creates a fixture and its fixture object in one history entry (feature 006, contracts/fixture-commands.md).
     * The visualization type is the given one, else the model's first type that fits the fixture type, else the
     * default type; the model is the given one, else the type's preselection/default. A new LED strip gets its LED
     * count from the path length (30 per meter). Selects the object and returns its id.
     */
    function addFixture(type: FixtureType, options: AddFixtureOptions = {}): string {
        const stage = useStage();
        const types = compatibleVisualizationTypes(type);
        const model = options.modelId ? assetCatalog.get(options.modelId) : undefined;
        const modelTypes = model?.category === "fixtures" ? model.fixture.visualizationTypes.filter((t) => types.includes(t)) : [];
        const visualizationType =
            options.visualizationType && types.includes(options.visualizationType)
                ? options.visualizationType
                : (modelTypes[0] ?? (type === FixtureType.LED_STRIP ? VisualizationType.LED_STRIP : DEFAULT_DMX_VISUALIZATION));
        const modelId = model?.category === "fixtures" && model.fixture.visualizationTypes.includes(visualizationType) ? model.id : undefined;
        const baseName = type === FixtureType.LED_STRIP ? "LED strip" : "DMX fixture";
        const name = options.name?.trim() || nextObjectName(scene.value, baseName);
        const parentId = options.parentId && scene.value.objects[options.parentId] ? options.parentId : null;
        const fixtureId = crypto.randomUUID() as string;
        let objectId = "";
        runCommand(options.label ?? `Add ${baseName}`, parentId ? [parentId] : [], () => {
            const template = createFixture(type);
            stage.applyFixtureSnapshot(fixtureId, { state: { id: fixtureId, type, name, config: template.config }, controllerId: null, groups: [] });
            const fixture = stage.fixtures.get(fixtureId)!;
            const fallback = modelForType(fixture, visualizationType, true);
            const modelFields: FixtureVisualizationModelFields = {
                modelId: modelId ?? fallback.modelId,
                modelScale: modelId ? modelScaleForFixture(fixture, modelId) : fallback.modelScale,
            };
            const config = withModelRanges(
                visualizationType,
                getVisualizationByType(visualizationType).defaultConfig(fixture as never, modelFields.modelId) as FixtureVisualizationObject["config"],
                modelFields.modelId
            );
            const obj = createFixtureVisualizationObject(fixtureId, visualizationType, config, name, modelFields);
            obj.position = placementPosition(options.placement);
            if (visualizationType === VisualizationType.LED_STRIP) {
                // strips emit along local +Y: new ones point down so they light the floor below them
                obj.rotation = [180, 0, 0];
            }
            applyWorldTransform(obj, options);
            obj.parentId = parentId;
            if (type === FixtureType.LED_STRIP) {
                const numLeds = stripPathLedCount((config as LedStripVisualizationConfig).path);
                fixture.setConfig({ ...(toRaw(fixture.config) as object), numLeds });
            }
            scene.value.objects[obj.id] = obj;
            siblingsOf(parentId).push(obj.id);
            objectId = obj.id;
            return { objects: [obj.id], fixtures: [fixtureId] };
        });
        select([objectId]);
        return objectId;
    }


    /** Research R8: a mapping that was never generated (no profile at creation) and never edited by hand. */
    function isPristineMapping(config: unknown): boolean {
        const mapping = (config as { mapping?: CapabilityMapping } | null)?.mapping;
        return !!mapping && mapping.mappedMode === null && !Object.values(mapping.channels).some((entry) => entry?.source === "manual");
    }

    /**
     * Changes a fixture's name, config or controller as one undoable entry (feature 006, research R7). The name also
     * renames the fixture object (I2); controllers that cannot control the fixture type are ignored (I4). When a DMX
     * fixture's profile or mode changes and its object's mapping is pristine, the object gets the category
     * preselection (only if it still shows the default type and model) and a freshly auto-mapped config (R8).
     */
    function updateFixture(fixtureId: string, patch: FixturePatch, label: string, mergeKey?: string) {
        const stage = useStage();
        const current = stage.snapshotFixture(fixtureId);
        if (!current) {
            return;
        }
        const next: FixtureSnapshot = structuredClone(current);
        const name = patch.name?.trim();
        if (name) {
            next.state.name = name;
        }
        if (patch.config) {
            next.state.config = JSON.parse(JSON.stringify(patch.config));
        }
        if (patch.controllerId !== undefined) {
            const controller = patch.controllerId ? stage.controllers.get(patch.controllerId) : undefined;
            if (patch.controllerId && !controller?.compatibleFixtures.includes(current.state.type)) {
                return;
            }
            next.controllerId = patch.controllerId;
        }
        if (JSON.stringify(next) === JSON.stringify(current)) {
            return;
        }

        const raw = Object.values(rawScene().objects).find((o): o is FixtureVisualizationObject => isFixtureVisualization(o) && o.fixtureId === fixtureId);
        const before = current.state.config as DmxProfileFields;
        const after = next.state.config as DmxProfileFields;
        const profileChanged =
            current.state.type === FixtureType.DMX &&
            (JSON.stringify(before?.mode ?? null) !== JSON.stringify(after?.mode ?? null) ||
                JSON.stringify(before?.definition ?? null) !== JSON.stringify(after?.definition ?? null));
        const remap = !!raw && profileChanged && isPristineMapping(raw.config);

        runCommand(
            label,
            raw ? [raw.id] : [],
            () => {
                stage.applyFixtureSnapshot(fixtureId, next);
                if (!raw) {
                    return;
                }
                const obj = scene.value.objects[raw.id] as FixtureVisualizationObject;
                if (name) {
                    obj.name = name;
                }
                if (remap) {
                    const fixture = stage.fixtures.get(fixtureId)!;
                    let { visualizationType, modelId, modelScale } = raw;
                    const preselection = preselectionOf(fixture);
                    if (preselection && visualizationType === DEFAULT_DMX_VISUALIZATION && usesDefaultModel(raw)) {
                        ({ visualizationType, modelId, modelScale } = preselection);
                    }
                    const config = withModelRanges(
                        visualizationType,
                        getVisualizationByType(visualizationType).defaultConfig(fixture as never, modelId) as FixtureVisualizationObject["config"],
                        modelId
                    );
                    Object.assign(obj, { visualizationType, modelId, modelScale, config });
                }
            },
            true,
            mergeKey,
            { fixtures: [fixtureId] }
        );
    }

    /**
     * Replaces type and config (default config of the new type), keeps id, name, transform and parent. The model
     * becomes the fixture's mapped model if it supports the new type, otherwise the type's default (invariant 2).
     */
    function setVisualizationType(objectId: string, type: VisualizationType) {
        const obj = scene.value.objects[objectId];
        if (!obj || !isFixtureVisualization(obj) || obj.visualizationType === type) {
            return;
        }
        const fixture = obj.fixtureId ? useStage().fixtures.get(obj.fixtureId) : undefined;
        const { modelId, modelScale } = modelForType(fixture, type, false);
        const config = withModelRanges(type, getVisualizationByType(type).defaultConfig(fixture as never, modelId), modelId);
        updateObjects({ [objectId]: { visualizationType: type, config, modelId, modelScale } as Partial<SceneObject> }, "Change visualization type");
    }

    /**
     * Switches the model and keeps everything else (invariant 4). With plausible fixture dimensions, the scale is
     * recomputed for the new model.
     */
    function setFixtureModel(objectId: string, modelId: string) {
        const obj = scene.value.objects[objectId];
        const definition = assetCatalog.get(modelId);
        if (!obj || !isFixtureVisualization(obj) || obj.modelId === modelId) {
            return;
        }
        if (definition?.category !== "fixtures" || !definition.fixture.visualizationTypes.includes(obj.visualizationType)) {
            return;
        }
        const fixture = obj.fixtureId ? useStage().fixtures.get(obj.fixtureId) : undefined;
        const patch: Partial<FixtureVisualizationModelFields> = { modelId };
        if (hasPlausibleDimensions(fixture)) {
            patch.modelScale = modelScaleForFixture(fixture, modelId);
        }
        updateObjects({ [objectId]: patch as Partial<SceneObject> }, "Change model");
    }

    function resetModelScale(objectId: string) {
        const obj = scene.value.objects[objectId];
        if (!obj || !isFixtureVisualization(obj) || obj.modelScale === 1) {
            return;
        }
        updateObjects({ [objectId]: { modelScale: 1 } as Partial<SceneObject> }, "Reset model size");
    }

    /**
     * Sets the path of an LED strip visualization (feature 003, T049). The path is validated per data-model §3
     * (finite coordinates, normalized normals, at least 2 distinct points); an invalid path changes nothing and
     * returns false. With `preview`, the change is applied without a history entry (drags: `captureBeforeStates`,
     * then `setStripPath(..., { preview: true })` per move, then `commitPreview(before, label)`).
     */
    function setStripPath(
        objectId: string,
        path: StripPath,
        label = "Edit LED strip path",
        options?: { preview?: boolean; syncLedCount?: boolean }
    ): boolean {
        const obj = scene.value.objects[objectId];
        if (!obj || !isFixtureVisualization(obj) || obj.visualizationType !== VisualizationType.LED_STRIP) {
            return false;
        }
        const valid = validateStripPath(structuredClone(toRaw(path)));
        if (!valid) {
            return false;
        }
        const config: LedStripVisualizationConfig = { ...(toRaw(obj.config) as LedStripVisualizationConfig), path: valid };
        const patches = { [objectId]: { config } as Partial<SceneObject> };
        const fixture = obj.fixtureId ? useStage().fixtures.get(obj.fixtureId) : undefined;
        if (options?.preview) {
            previewPatches(patches);
        } else if (options?.syncLedCount && fixture?.type === FixtureType.LED_STRIP) {
            // a new strip drawn with the strip tool: the LED count follows the drawn length (30 per meter)
            const numLeds = stripPathLedCount(valid);
            runCommand(
                label,
                [objectId],
                () => {
                    (scene.value.objects[objectId] as FixtureVisualizationObject).config = structuredClone(config);
                    fixture.setConfig({ ...(toRaw(fixture.config) as object), numLeds });
                },
                true,
                undefined,
                { fixtures: [fixture.id] }
            );
        } else {
            updateObjects(patches, label);
        }
        return true;
    }

    /** True if the most recent history entry created `objectId`. */
    function isAddEntry(entry: { before: ObjectStates; after: ObjectStates } | undefined, objectId: string): boolean {
        return !!entry && entry.before[objectId] === null && !!entry.after[objectId];
    }

    /**
     * Cancels the creation of an object (strip drawing tool, Esc on a new strip): the object and its fixture are
     * removed without a history entry, and its add entry is dropped from the history if it is the most recent one.
     */
    function discardAddedObject(objectId: string) {
        if (isAddEntry(history.top, objectId)) {
            history.discardTop();
            bumpHistory();
        }
        removeObjects([objectId], false);
    }

    /**
     * Combines the most recent entry with the add entry of `objectId` directly below it, so creating and first
     * editing a new object is one undo step (strip drawing tool: "Draw LED strip").
     */
    function mergeWithAddEntry(objectId: string, label: string) {
        if (isAddEntry(history.belowTop, objectId) && history.top && objectId in history.top.after) {
            history.mergeTopTwo(label);
            bumpHistory();
        }
    }

    // preview API for drags ----------------------------------------------------------------------------------

    /** Updates state and sinks without a history entry. */
    function previewTransforms(transforms: Record<string, Partial<LocalTransform>>) {
        const ids = Object.keys(transforms).filter((id) => scene.value.objects[id]);
        for (const id of ids) {
            const patch = clampPatch(transforms[id] as Partial<SceneObject>);
            // parametric library assets are resized through their parameters, never scaled (T078)
            if (patch.scale && isParametricLibraryAsset(scene.value.objects[id])) {
                delete patch.scale;
            }
            Object.assign(scene.value.objects[id], patch);
        }
        notifyStates(ids);
    }

    /** Previews arbitrary object patches (e.g. LED strip endpoints) without a history entry. */
    function previewPatches(patches: Record<string, Partial<SceneObject>>) {
        applyPatches(patches, false, "Preview");
    }

    function captureBeforeStates(ids: string[]): ObjectStates {
        return captureStates(ids);
    }

    /**
     * Records a finished preview drag as one history entry. With `reparent`, the objects are also moved under
     * `reparent.parentId` (world transform kept) in the same entry, e.g. a fixture mounted by gizmo snapping (T083).
     */
    function commitPreview(before: ObjectStates, label: string, options?: { reparent?: { ids: string[]; parentId: string | null } }) {
        const move = options?.reparent;
        if (move) {
            const newParentId = move.parentId;
            const roots = getSelectionRoots(rawScene(), move.ids).filter(
                (id) => rawObject(id) && rawObject(id)!.parentId !== newParentId && !wouldCreateCycle(rawScene(), id, newParentId)
            );
            if (roots.length > 0 && (!newParentId || rawObject(newParentId))) {
                // parents are not changed by the preview: their current state is their state before the drag
                const parents = unique([...parentsOf(roots), ...(newParentId ? [newParentId] : [])]).filter((id) => !(id in before));
                const fullBefore: ObjectStates = { ...captureStates(parents), ...cloneStates(before) };
                const rootOrderBefore = [...rawScene().rootOrder];
                moveToParent(roots, newParentId);
                const ids = unique([...Object.keys(fullBefore), ...roots]);
                history.push({
                    label,
                    before: fullBefore,
                    after: captureStates(ids),
                    rootOrderBefore,
                    rootOrderAfter: [...rawScene().rootOrder],
                });
                bumpHistory();
                notifyStates(ids);
                return;
            }
        }
        const ids = Object.keys(before);
        const after = captureStates(ids);
        // skip no-op drags
        if (ids.every((id) => JSON.stringify(before[id]) === JSON.stringify(after[id]))) {
            return;
        }
        history.push({
            label,
            before: cloneStates(before),
            after,
            rootOrderBefore: [...rawScene().rootOrder],
            rootOrderAfter: [...rawScene().rootOrder],
        });
        bumpHistory();
    }

    function cancelPreview(before: ObjectStates) {
        applyObjectStates(scene.value, cloneStates(before), [...rawScene().rootOrder]);
        notifyStates(Object.keys(before));
    }

    // undo / redo --------------------------------------------------------------------------------------------

    function applyHistoryStates(states: ObjectStates, rootOrder: string[]) {
        const stage = useStage();
        const linked = new Set<string>();
        for (const obj of Object.values(rawScene().objects)) {
            if (isFixtureVisualization(obj) && obj.fixtureId && !(obj.id in states)) {
                linked.add(obj.fixtureId);
            }
        }
        const fixed: ObjectStates = {};
        for (const [id, state] of Object.entries(states)) {
            if (state && isFixtureVisualization(state) && state.fixtureId) {
                // data-model invariants 3 and 5
                if (!stage.fixtures.has(state.fixtureId) || linked.has(state.fixtureId)) {
                    fixed[id] = { ...cloneObject(state), fixtureId: null } as SceneObject;
                    continue;
                }
                linked.add(state.fixtureId);
            }
            fixed[id] = state;
        }
        applyObjectStates(scene.value, fixed, rootOrder);
        notifyStates(Object.keys(fixed));
        pruneSelection();
    }

    function applyHistoryEnvironment(environment: SceneEnvironment | undefined) {
        if (environment) {
            scene.value.environment = structuredClone(environment);
            notifyEnvironment();
        }
    }

    /** Fixtures are applied before the object states, so the link repair in `applyHistoryStates` sees them (R5). */
    function applyHistoryFixtures(states: FixtureStates | undefined) {
        if (!states) {
            return;
        }
        const stage = useStage();
        for (const [id, snapshot] of Object.entries(states)) {
            stage.applyFixtureSnapshot(id, snapshot);
        }
    }

    function undo() {
        const entry = history.undo();
        if (entry) {
            applyHistoryFixtures(entry.fixturesBefore);
            applyHistoryStates(entry.before, entry.rootOrderBefore);
            applyHistoryEnvironment(entry.environmentBefore);
            bumpHistory();
        }
        return entry?.label;
    }

    function redo() {
        const entry = history.redo();
        if (entry) {
            applyHistoryFixtures(entry.fixturesAfter);
            applyHistoryStates(entry.after, entry.rootOrderAfter);
            applyHistoryEnvironment(entry.environmentAfter);
            bumpHistory();
        }
        return entry?.label;
    }

    // shapes, groups, duplicate, clipboard --------------------------------------------------------------------

    function placementPosition(placement: Placement, liftBy = 0): Vec3 {
        if (!placement) {
            return [0, liftBy, 0];
        }
        const { point, normal } = placement;
        return [point[0] + normal[0] * liftBy, point[1] + normal[1] * liftBy, point[2] + normal[2] * liftBy];
    }

    /** FR-030: the new object becomes the only selected object. */
    function addShape(shape: ShapeType, placement?: Placement): string {
        const obj = createShapeObject(shape, { name: nextObjectName(scene.value, SHAPE_LABELS[shape]) });
        // box, cylinder and plane have their origin on the bottom, a sphere is lifted by its radius
        const lift = obj.shape === "sphere" ? obj.dimensions.radius : 0;
        obj.position = placementPosition(placement, lift);
        addObjects([obj], null, `Add ${SHAPE_LABELS[shape]}`);
        select([obj.id]);
        return obj.id;
    }

    /** feature 004: aim target "Target n" at the given point (the camera target on the floor). */
    function addAimTarget(position: Vec3): string {
        const obj = createAimTargetObject({ name: nextObjectName(scene.value, "Target") });
        obj.position = [position[0], position[1], position[2]];
        addObjects([obj], null, "Add aim target");
        select([obj.id]);
        return obj.id;
    }

    function addGroup(placement?: Placement): string {
        const obj = createGroupObject({ name: nextObjectName(scene.value, "Group") });
        obj.position = placementPosition(placement);
        addObjects([obj], null, "Add Group");
        select([obj.id]);
        return obj.id;
    }

    /**
     * Deep copies of the subtrees below `rootIds` with new ids and the internal hierarchy preserved. Every copied
     * fixture object gets a new fixture from `fixtureSources` (new id, same config and controller, no groups) named
     * with the next free number (research R6); returned in `fixtures`, keyed by the new fixture id.
     */
    function cloneSubtrees(
        states: Record<string, SceneObject>,
        rootIds: string[],
        nameSuffix: string,
        offsetX: number,
        fixtureSources: Record<string, FixtureSnapshot>
    ) {
        const subtree: string[] = [];
        for (const rootId of rootIds) {
            subtree.push(rootId, ...getDescendantIds({ objects: states }, rootId));
        }
        const idMap = new Map<string, string>(unique(subtree).map((id) => [id, crypto.randomUUID() as string]));
        const copies: SceneObject[] = [];
        const newRootIds: string[] = [];
        const fixtures: Record<string, FixtureSnapshot> = {};
        // names already in use, including the copies named so far
        const named: Record<string, SceneObject> = { ...rawScene().objects };
        for (const [oldId, newId] of idMap) {
            const source = states[oldId];
            if (!source) continue;
            const copy = cloneObject(source);
            copy.id = newId;
            copy.children = source.children.map((c) => idMap.get(c)).filter((c): c is string => !!c);
            if (rootIds.includes(oldId)) {
                copy.name = `${source.name}${nameSuffix}`;
                copy.position = [source.position[0] + offsetX, source.position[1], source.position[2]];
                newRootIds.push(newId);
            } else {
                copy.parentId = source.parentId ? idMap.get(source.parentId) ?? null : null;
            }
            if (isFixtureVisualization(copy)) {
                const source = copy.fixtureId ? fixtureSources[copy.fixtureId] : undefined;
                if (source) {
                    const fixtureId = crypto.randomUUID() as string;
                    copy.name = nextObjectName({ objects: named }, baseNameOf(source.state.name));
                    copy.fixtureId = fixtureId;
                    fixtures[fixtureId] = {
                        state: { ...source.state, id: fixtureId, name: copy.name, config: structuredClone(source.state.config) },
                        controllerId: source.controllerId && useStage().controllers.has(source.controllerId) ? source.controllerId : null,
                        groups: [],
                    };
                } else {
                    copy.fixtureId = null;
                }
            }
            named[copy.id] = copy;
            copies.push(copy);
        }
        return { copies, newRootIds, fixtures };
    }

    function statesOf(ids: string[]): Record<string, SceneObject> {
        const result: Record<string, SceneObject> = {};
        for (const id of ids) {
            const obj = rawObject(id);
            if (obj) result[id] = cloneObject(obj);
        }
        return result;
    }

    function selectionRoots(): string[] {
        return getSelectionRoots(
            rawScene(),
            selection.value.filter((id) => scene.value.objects[id])
        );
    }

    function subtreeIds(roots: string[]): string[] {
        return unique(roots.flatMap((id) => [id, ...getDescendantIds(rawScene(), id)]));
    }

    /** Snapshots of the fixtures of all fixture objects in `states`, keyed by fixture id. */
    function fixtureSnapshotsOf(states: Record<string, SceneObject>): Record<string, FixtureSnapshot> {
        const stage = useStage();
        const result: Record<string, FixtureSnapshot> = {};
        for (const obj of Object.values(states)) {
            if (isFixtureVisualization(obj) && obj.fixtureId) {
                const snapshot = stage.snapshotFixture(obj.fixtureId);
                if (snapshot) result[obj.fixtureId] = snapshot;
            }
        }
        return result;
    }

    function duplicateSelection() {
        const roots = selectionRoots();
        if (roots.length === 0) return;
        const states = statesOf(subtreeIds(roots));
        const { copies, newRootIds, fixtures } = cloneSubtrees(states, roots, " copy", 0.25, fixtureSnapshotsOf(states));
        addObjects(copies, undefined, "Duplicate", fixtures);
        select(newRootIds);
    }

    function copySelection() {
        const roots = selectionRoots();
        if (roots.length === 0) return;
        const states = statesOf(subtreeIds(roots));
        clipboard.value = { objects: Object.values(states), rootIds: roots, fixtures: fixtureSnapshotsOf(states) };
    }

    function pasteClipboard() {
        const content = clipboard.value;
        if (!content) return;
        const states = Object.fromEntries(content.objects.map((o) => [o.id, o]));
        const { copies, newRootIds, fixtures } = cloneSubtrees(states, content.rootIds, " copy", 0.25, content.fixtures);
        addObjects(copies, undefined, "Paste", fixtures);
        select(newRootIds);
    }

    function deleteSelection() {
        const ids = [...selection.value];
        if (ids.length > 0) {
            removeObjects(ids);
        }
    }

    function setSelectionVisible(visible: boolean) {
        if (selection.value.length > 0) setVisible([...selection.value], visible);
    }

    function toggleSelectionVisible() {
        const ids = [...selection.value];
        if (ids.length === 0) return;
        const anyVisible = ids.some((id) => scene.value.objects[id]?.visible);
        setVisible(ids, !anyVisible);
    }

    /** Moves the selection out of its parent (keeps the world transform). */
    function unparentSelection() {
        const roots = selectionRoots().filter((id) => scene.value.objects[id].parentId !== null);
        if (roots.length > 0) reparent(roots, null);
    }

    // align / distribute (US8) ---------------------------------------------------------------------------------

    function alignSelection(axis: Axis) {
        const roots = selectionRoots();
        if (roots.length < 2) return;
        const active = roots.includes(activeId.value ?? "") ? (activeId.value as string) : roots[roots.length - 1];
        const transforms = alignToActive(rawScene(), roots, active, axis);
        updateObjects(
            Object.fromEntries(Object.entries(transforms).map(([id, t]) => [id, t as Partial<SceneObject>])),
            `Align ${axis.toUpperCase()}`
        );
    }

    function distributeSelection(axis: Axis) {
        const roots = selectionRoots();
        if (roots.length < 3) return;
        const transforms = distributeEvenly(rawScene(), roots, axis);
        updateObjects(
            Object.fromEntries(Object.entries(transforms).map(([id, t]) => [id, t as Partial<SceneObject>])),
            `Distribute ${axis.toUpperCase()}`
        );
    }

    // camera positions (no history, FR-040 covers objects only) ----------------------------------------------

    function notifyCameras() {
        const cameras = structuredClone(toRaw(scene.value.cameras));
        for (const sink of sinks) sink.camerasChanged(cameras);
    }

    function saveCameraPosition(name: string, pose: CameraPose): string | null {
        const trimmed = name.trim();
        const same = pose.position[0] === pose.target[0] && pose.position[1] === pose.target[1] && pose.position[2] === pose.target[2];
        if (trimmed.length === 0 || same) return null;
        const id = crypto.randomUUID();
        scene.value.cameras.push({
            id,
            name: trimmed,
            position: [...pose.position],
            target: [...pose.target],
            fov: Math.min(120, Math.max(10, pose.fov)),
            isShowDefault: false,
        });
        notifyCameras();
        return id;
    }

    function renameCameraPosition(id: string, name: string) {
        const camera = scene.value.cameras.find((c) => c.id === id);
        if (camera && name.trim().length > 0) {
            camera.name = name.trim();
            notifyCameras();
        }
    }

    function deleteCameraPosition(id: string) {
        const index = scene.value.cameras.findIndex((c) => c.id === id);
        if (index !== -1) {
            scene.value.cameras.splice(index, 1);
            notifyCameras();
        }
    }

    /** At most one camera position is the show default. */
    function setShowDefault(id: string | null) {
        for (const camera of scene.value.cameras) {
            camera.isShowDefault = camera.id === id;
        }
        notifyCameras();
    }

    // imported models (US7) ------------------------------------------------------------------------------------

    /** Adds the asset and the object in one history entry. Sinks get the asset before the object. */
    function addImportedModel(asset: SceneAsset, name: string, scale: number, placement?: Placement): string {
        scene.value.assets[asset.id] = asset;
        for (const sink of sinks) sink.asset(asset.id, asset.mimeType, asset.data);
        const obj = createImportedModelObject(asset.id, name);
        obj.position = placementPosition(placement);
        obj.scale = [scale, scale, scale];
        addObjects([obj], null, "Import model");
        select([obj.id]);
        return obj.id;
    }

    // library assets (feature 002) ----------------------------------------------------------------------------

    /**
     * Adds a library item (stage element or decoration) and selects it. Fixture models become fixture visualizations
     * and basic shapes become shape objects, so neither is added here (research R4).
     */
    function addLibraryAsset(assetId: string, placement?: Placement, options?: AddAssetOptions): string | null {
        const definition = assetCatalog.get(assetId);
        if (!definition || definition.category === "fixtures" || definition.source.type === "shape") {
            return null;
        }
        const obj = createLibraryAssetObject(definition, { name: nextObjectName(scene.value, definition.name) });
        obj.position = placementPosition(placement);
        const parentId = applyWorldTransform(obj, options);
        if (definition.source.type === "parametric") {
            // parametric elements are never scaled (T078)
            obj.scale = [1, 1, 1];
        }
        addObjects([obj], parentId, `Add ${definition.name}`);
        select([obj.id]);
        return obj.id;
    }

    /**
     * A fixture model from the library becomes a new fixture with a fixture object of that model (feature 006):
     * LED strip models create an LED strip fixture, all others an unpatched DMX fixture. Selects it.
     */
    function addFixtureModel(modelId: string, placement?: Placement, options?: AddAssetOptions): string | null {
        const definition = assetCatalog.get(modelId);
        if (definition?.category !== "fixtures" || definition.fixture.visualizationTypes.length === 0) {
            return null;
        }
        const type = definition.fixture.visualizationTypes.includes(VisualizationType.LED_STRIP) ? FixtureType.LED_STRIP : FixtureType.DMX;
        return addFixture(type, {
            ...options,
            placement,
            modelId,
            name: nextObjectName(scene.value, definition.name),
            label: `Add ${definition.name}`,
        });
    }

    /**
     * Sets the transform of a new object from `options.worldTransform`, relative to `options.parentId` (snapping,
     * T082). Returns the parent to add the object under (null = scene root).
     */
    function applyWorldTransform(obj: SceneObject, options?: AddAssetOptions): string | null {
        const parentId = options?.parentId && scene.value.objects[options.parentId] ? options.parentId : null;
        const world = options?.worldTransform;
        if (world) {
            const local = worldToLocal(rawScene(), parentId, toMatrix({ position: world.position, rotation: world.rotation, scale: world.scale ?? [1, 1, 1] }));
            obj.position = local.position;
            obj.rotation = local.rotation;
            obj.scale = local.scale.map((v) => Math.max(MIN_SCALE, v)) as Vec3;
        }
        return parentId;
    }

    function libraryAssetOf(id: string) {
        const obj = scene.value.objects[id];
        return obj && isLibraryAsset(obj) ? obj : undefined;
    }

    function setAssetParams(id: string, partialParams: Partial<ParamValues>) {
        const obj = libraryAssetOf(id);
        const definition = obj ? assetCatalog.get(obj.assetId) : undefined;
        if (!obj || !definition) return;
        const params = completeParams(definition, { ...toRaw(obj.params), ...partialParams });
        updateObjects({ [id]: { params, size: sizeOf(definition, params) } as Partial<SceneObject> }, "Change parameters", `params:${id}`);
    }

    /** research R14: choosing a preset also sets the color to the preset color. */
    function materialPatch(material: MaterialPresetId | null): Partial<SceneObject> | null {
        if (material === null) {
            return { material: null } as Partial<SceneObject>;
        }
        if (!isMaterialPresetId(material)) {
            return null;
        }
        return { material, color: MATERIAL_PRESETS[material].color } as Partial<SceneObject>;
    }

    function setAssetMaterial(id: string, material: MaterialPresetId | null) {
        const patch = materialPatch(material);
        if (!libraryAssetOf(id) || !patch) return;
        updateObjects({ [id]: patch }, "Change material");
    }

    function setAssetColor(id: string, color: string | null) {
        if (!libraryAssetOf(id) || (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color))) return;
        updateObjects({ [id]: { color } as Partial<SceneObject> }, "Change color", `color:${id}`);
    }

    function setAssetVariant(id: string, variant: string | null) {
        if (!libraryAssetOf(id)) return;
        updateObjects({ [id]: { variant } as Partial<SceneObject> }, "Change variant");
    }

    /** Keeps id, name, transform, parent and children; resets the asset-specific fields. */
    function replaceAsset(id: string, newAssetId: string) {
        const definition = assetCatalog.get(newAssetId);
        if (!libraryAssetOf(id) || !definition || definition.category === "fixtures" || definition.source.type === "shape") return;
        const params = completeParams(definition, {});
        updateObjects(
            {
                [id]: {
                    assetId: definition.id,
                    params,
                    material: null,
                    color: null,
                    variant: null,
                    size: sizeOf(definition, params),
                    // parametric elements get their size from the parameters, never from a scale (T078)
                    ...(definition.source.type === "parametric" ? { scale: [1, 1, 1] } : {}),
                } as Partial<SceneObject>,
            },
            "Replace asset"
        );
    }

    function setShapeMaterial(id: string, material: MaterialPresetId | null) {
        const obj = scene.value.objects[id];
        const patch = materialPatch(material);
        if (!obj || !isShape(obj) || !patch) return;
        updateObjects({ [id]: patch }, "Change material");
    }

    // selection ----------------------------------------------------------------------------------------------

    function select(ids: string[], mode: SelectMode = "replace") {
        const valid = ids.filter((id) => scene.value.objects[id]);
        if (mode === "replace") {
            selection.value = unique(valid);
        } else if (mode === "add") {
            selection.value = unique([...selection.value.filter((id) => !valid.includes(id)), ...valid]);
        } else {
            const next = [...selection.value];
            for (const id of valid) {
                const index = next.indexOf(id);
                if (index === -1) next.push(id);
                else next.splice(index, 1);
            }
            selection.value = next;
        }
    }

    function clearSelection() {
        if (selection.value.length > 0) {
            selection.value = [];
        }
    }

    /** All objects that can be picked in 3D: effectively visible and unlocked. */
    function selectAll() {
        const s = rawScene();
        selection.value = Object.values(s.objects)
            .filter((o) => !o.locked && isEffectivelyVisible(s, o.id))
            .map((o) => o.id);
    }

    // sinks --------------------------------------------------------------------------------------------------

    function registerSink(sink: SceneSink, pushFixtureState = true): () => void {
        sinks.add(sink);
        sink.reset(rawScene());
        for (const hook of sinkHooks) runSinkHook(hook, sink);
        if (pushFixtureState) {
            useStage().visualization.sendStateTo(sink);
        }
        return () => {
            sinks.delete(sink);
            for (const cleanup of sinkCleanups.get(sink) ?? []) cleanup();
            sinkCleanups.delete(sink);
        };
    }

    function runSinkHook(hook: SinkHook, sink: SceneSink) {
        const cleanup = hook(sink);
        if (cleanup) {
            const list = sinkCleanups.get(sink) ?? [];
            list.push(cleanup);
            sinkCleanups.set(sink, list);
        }
    }

    /** Calls `hook` for every registered sink, now and in the future (research R15: VisualizationServer → onActivated). */
    function onSinkRegistered(hook: SinkHook): () => void {
        sinkHooks.add(hook);
        for (const sink of sinks) runSinkHook(hook, sink);
        return () => {
            sinkHooks.delete(hook);
        };
    }

    function forEachSink(fn: (sink: SceneSink) => void) {
        for (const sink of sinks) fn(sink);
    }

    /** Only sinks with at least one visible consumer (FR-053); fixture values go only to these. */
    function forEachActiveSink(fn: (sink: SceneSink) => void) {
        for (const sink of sinks) {
            if (sink.active) fn(sink);
        }
    }

    // non-history state --------------------------------------------------------------------------------------

    function setEditorCamera(pose: CameraPose) {
        scene.value.editorCamera = { position: [...pose.position], target: [...pose.target], fov: pose.fov };
    }

    function updateSettings(partial: Partial<SceneEditorSettings>) {
        Object.assign(scene.value.settings, partial);
    }

    // load / save --------------------------------------------------------------------------------------------

    function load(state: SceneState) {
        scene.value = state;
        history.clear();
        bumpHistory();
        selection.value = [];
        clipboard.value = null;
        for (const sink of sinks) sink.reset(rawScene());
        notifyEnvironment();
    }

    function reset() {
        load(createDefaultScene());
    }

    function save(): PersistedSceneState {
        const s = rawScene();
        const referenced = collectReferencedAssetIds([...Object.values(s.objects), ...history.allStates()]);
        return {
            formatVersion: 1,
            objects: structuredClone(s.objects),
            rootOrder: [...s.rootOrder],
            cameras: structuredClone(s.cameras),
            editorCamera: structuredClone(s.editorCamera),
            settings: structuredClone(s.settings),
            environment: structuredClone(s.environment),
            assets: serializeAssets(s.assets, referenced),
        };
    }


    return {
        scene,
        selection,
        activeId,
        transformMode,
        clipboard,
        canUndo,
        canRedo,
        history,
        historyVersion,
        // commands
        addObjects,
        updateObjects,
        removeObjects,
        reparent,
        setVisible,
        setLocked,
        rename,
        previewTransforms,
        previewPatches,
        captureBeforeStates,
        commitPreview,
        cancelPreview,
        undo,
        redo,
        // fixture visualizations
        findObjectByFixture,
        addFixture,
        updateFixture,
        setVisualizationType,
        setFixtureModel,
        resetModelScale,
        setStripPath,
        discardAddedObject,
        mergeWithAddEntry,
        // shapes, groups, clipboard
        addShape,
        addGroup,
        addAimTarget,
        duplicateSelection,
        copySelection,
        pasteClipboard,
        deleteSelection,
        setSelectionVisible,
        toggleSelectionVisible,
        unparentSelection,
        alignSelection,
        distributeSelection,
        // cameras
        saveCameraPosition,
        renameCameraPosition,
        deleteCameraPosition,
        setShowDefault,
        // models
        addImportedModel,
        // library assets
        addLibraryAsset,
        addFixtureModel,
        setAssetParams,
        setAssetMaterial,
        setAssetColor,
        setAssetVariant,
        replaceAsset,
        setShapeMaterial,
        // selection
        select,
        clearSelection,
        selectAll,
        // sinks
        registerSink,
        onSinkRegistered,
        forEachSink,
        forEachActiveSink,
        // other state
        setEditorCamera,
        updateSettings,
        setEnvironment,
        load,
        reset,
        save,
        // internal helpers shared with the commands added by later features
        rawScene,
        runCommand,
    };
});
