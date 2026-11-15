<template>
    <div ref="root" class="scene-editor">
        <EditorToolbar :overlay="overlay" @add="onAdd" @draw-strip="drawNewStrip" @undo="undo" @redo="redo" />
        <splitpanes class="panes">
            <pane size="18" min-size="10">
                <div class="left-column">
                    <Outliner v-show="leftTab === 'scene'" ref="outliner" @contextmenu="showContextMenu">
                        <template #header>
                            <SelectButton v-model="leftTab" :options="LEFT_TABS" option-label="label" option-value="value" :allow-empty="false" size="small" aria-label="Sidebar" />
                        </template>
                    </Outliner>
                    <AssetLibraryPanel v-show="leftTab === 'assets'" @add="addAssetAtCenter" @show-credits="showCredits = true">
                        <template #header>
                            <SelectButton v-model="leftTab" :options="LEFT_TABS" option-label="label" option-value="value" :allow-empty="false" size="small" aria-label="Sidebar" />
                        </template>
                    </AssetLibraryPanel>
                </div>
            </pane>
            <pane size="58" min-size="20">
                <Viewport ref="viewport" @contextmenu="showContextMenu" />
            </pane>
            <pane size="24" :min-size="inspectorMinSize">
                <Inspector />
            </pane>
        </splitpanes>
        <ContextMenu ref="contextMenu" :model="contextMenuItems" />
        <AssetCreditsDialog v-model:visible="showCredits" />
        <ChooseFixtureDialog v-model="showProfileDialog" @set-fixture="applyProfile" />
        <ConfirmDialog group="scene-delete-aim-targets" />
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, provide, ref, toRaw, watch } from "vue";
import { Splitpanes, Pane } from "splitpanes";
import ContextMenu from "primevue/contextmenu";
import SelectButton from "primevue/selectbutton";
import ConfirmDialog from "primevue/confirmdialog";
import { useConfirm } from "primevue/useconfirm";
import type { MenuItem } from "primevue/menuitem";
import { useElementSize, useFocusWithin } from "@vueuse/core";

import { useStage } from "@/stage/stage";
import { focusRequest } from "@/views/stageViewState";
import { FixtureType, type DmxFixture } from "@/stage/fixtures";
import ChooseFixtureDialog from "@/stage/fixtures/dmx/ChooseFixtureDialog.vue";
import type { Fixture as OpenFixtureDefinition } from "@/stage/fixtures/dmx/open-fixture";
import { STRIP_PATH_TOOL_KEY, type StripPathToolApi } from "@/visualization/fixtureVisualizations/ledStrip/stripPathToolApi";
import { useScene } from "../sceneStore";
import { isAimTarget } from "../model/types";
import { getDescendantIds } from "../model/transformMath";
import { aimTargetUses } from "@/programming/uses";
import EditorToolbar, { type AddKind } from "./EditorToolbar.vue";
import Outliner from "./Outliner.vue";
import Viewport from "./Viewport.vue";
import Inspector from "./Inspector.vue";
import AssetLibraryPanel from "./library/AssetLibraryPanel.vue";
import AssetCreditsDialog from "./library/AssetCreditsDialog.vue";
import { addAssetById } from "./assetDrop";
import { importModelFile } from "./modelImport";
import { useEditorShortcuts } from "./useEditorShortcuts";
import { EDITOR_ACTIONS_KEY } from "./editorActions";

const store = useScene();
const stage = useStage();
const confirm = useConfirm();

/** Delete; aim targets used by looks/presets ask first (feature 004, contracts/programming-ui.md). */
function deleteSelectionConfirmed() {
    const ids = new Set<string>();
    for (const id of store.selection) {
        ids.add(id);
        getDescendantIds(store.scene, id).forEach((d) => ids.add(d));
    }
    const targets = [...ids].filter((id) => {
        const obj = store.scene.objects[id];
        return !!obj && isAimTarget(obj);
    });
    const uses = targets.length > 0 ? aimTargetUses(targets) : { looks: 0, presets: 0 };
    if (uses.looks + uses.presets === 0) {
        store.deleteSelection();
        return;
    }
    confirm.require({
        group: "scene-delete-aim-targets",
        header: "Delete aim target",
        message: `Used by ${uses.looks} look${uses.looks === 1 ? "" : "s"} / ${uses.presets} preset${uses.presets === 1 ? "" : "s"}. Aimed fixtures fall back to centered pan/tilt. Delete anyway?`,
        icon: "pi pi-exclamation-triangle",
        acceptLabel: "Delete",
        rejectLabel: "Cancel",
        accept: () => store.deleteSelection(),
    });
}

const root = ref<HTMLElement>();
const viewport = ref<InstanceType<typeof Viewport>>();
const outliner = ref<InstanceType<typeof Outliner>>();

/** The left sidebar shows either the scene outliner or the asset library. */
type LeftTab = "scene" | "assets";
const LEFT_TABS: Array<{ label: string; value: LeftTab }> = [
    { label: "Scene", value: "scene" },
    { label: "Assets", value: "assets" },
];
const leftTab = ref<LeftTab>("scene");
const contextMenu = ref<InstanceType<typeof ContextMenu>>();
const showProfileDialog = ref(false);
/** Fixture the profile dialog applies its choice to (Add → DMX fixture, inspector "Choose profile…"). */
const profileFixtureId = ref<string | null>(null);
const showCredits = ref(false);

const overlay = computed(() => viewport.value?.overlay ?? null);

/** research R13: splitpanes sizes are percentages; the inspector never gets narrower than 320 px. */
const INSPECTOR_MIN_WIDTH = 320;
const { width: editorWidth } = useElementSize(root);
const inspectorMinSize = computed(() =>
    editorWidth.value > 0 ? Math.min(50, Math.max(12, (INSPECTOR_MIN_WIDTH / editorWidth.value) * 100)) : 20
);
const { focused } = useFocusWithin(root);
// shortcuts work while the pointer is over the viewport or focus is inside the editor
const isActive = computed(() => focused.value || !!viewport.value?.hovered);

function undo() {
    // undo cancels a running drag instead of changing the history
    if (!overlay.value?.cancelDrag()) {
        store.undo();
    }
}

function redo() {
    if (!overlay.value?.isDragging) {
        store.redo();
    }
}

useEditorShortcuts(isActive, {
    moveMode: () => (store.transformMode = "translate"),
    rotateMode: () => (store.transformMode = "rotate"),
    scaleMode: () => (store.transformMode = "scale"),
    toggleSpace: () => store.updateSettings({ transformSpace: store.scene.settings.transformSpace === "world" ? "local" : "world" }),
    delete: () => deleteSelectionConfirmed(),
    duplicate: () => store.duplicateSelection(),
    copy: () => store.copySelection(),
    paste: () => store.pasteClipboard(),
    undo,
    redo,
    selectAll: () => store.selectAll(),
    focus: () => overlay.value?.focusSelection(),
    toggleVisibility: () => store.toggleSelectionVisible(),
    toggleSnap: () => store.updateSettings({ snapEnabled: !store.scene.settings.snapEnabled }),
    viewFront: () => overlay.value?.setView("front"),
    viewSide: () => overlay.value?.setView("side"),
    viewTop: () => overlay.value?.setView("top"),
    viewPerspective: () => overlay.value?.setView("perspective"),
    // Escape cancels a running drag, otherwise it clears the selection
    escape: () => {
        if (!overlay.value?.cancelDrag()) {
            store.clearSelection();
        }
    },
    rename: () => {
        leftTab.value = "scene";
        void nextTick(() => outliner.value?.startRename());
    },
});

// --- add -------------------------------------------------------------------------------------------------------

function onAdd(kind: AddKind) {
    const hit = overlay.value?.getLastSurfaceHit() ?? null;
    switch (kind) {
        case "box":
        case "cylinder":
        case "plane":
        case "sphere":
            store.addShape(kind, hit);
            break;
        case "group":
            store.addGroup(hit);
            break;
        case "dmxFixture":
            // feature 006: the fixture is created unpatched; the profile dialog patches it (cancel keeps it unpatched)
            chooseProfile(store.addFixture(FixtureType.DMX, { placement: hit }));
            break;
        case "ledStrip":
            store.addFixture(FixtureType.LED_STRIP, { placement: hit });
            break;
        case "model":
            void importModelFile(store, hit);
            break;
        case "aimTarget": {
            // feature 004: at the camera target, on the floor
            const target = overlay.value?.getCameraPose().target ?? [0, 0, 0];
            store.addAimTarget([target[0], 0, target[2]]);
            break;
        }
    }
}

// --- LED strip path tool (feature 003, T052/T053) --------------------------------------------------------------

/** Toolbar "Draw LED strip": a new LED strip fixture, drawn right away (removed again on Esc). */
function drawNewStrip() {
    const editorOverlay = overlay.value;
    if (!editorOverlay) {
        return;
    }
    const id = store.addFixture(FixtureType.LED_STRIP);
    if (!editorOverlay.startStripTool(id, "drawing", { isNew: true })) {
        store.discardAddedObject(id);
    }
}

const stripPathToolApi: StripPathToolApi = {
    state: computed(() => overlay.value?.toolState.value ?? null),
    draw: (objectId) => overlay.value?.startStripTool(objectId, "drawing"),
    edit: (objectId) => overlay.value?.startStripTool(objectId, "editing"),
    stop: () => overlay.value?.stopTool(),
    setPath: (objectId, path) => store.setStripPath(objectId, path),
};
provide(STRIP_PATH_TOOL_KEY, stripPathToolApi);

// --- DMX profile (feature 006) ------------------------------------------------------------------------------------

/** Opens the profile dialog for the fixture of the object `objectId` or the fixture `fixtureId`. */
function chooseProfile(id: string) {
    const obj = store.scene.objects[id];
    const fixtureId = obj && "fixtureId" in obj ? (obj.fixtureId as string | null) : id;
    if (!fixtureId || stage.fixtures.get(fixtureId)?.type !== FixtureType.DMX) {
        return;
    }
    profileFixtureId.value = fixtureId;
    showProfileDialog.value = true;
}

/** One undo step; a pristine mapping is auto-mapped and the model preselected (research R8). */
function applyProfile(definition: OpenFixtureDefinition) {
    const fixture = profileFixtureId.value ? (stage.fixtures.get(profileFixtureId.value) as DmxFixture | undefined) : undefined;
    if (!fixture || fixture.type !== FixtureType.DMX) {
        return;
    }
    store.updateFixture(fixture.id, { config: { ...toRaw(fixture.config), definition, mode: definition.modes[0] ?? null } }, "Choose profile");
}

// the dialog closes when its fixture disappears (undo of the add)
watch(
    () => !!profileFixtureId.value && stage.fixtures.has(profileFixtureId.value),
    (exists) => {
        if (!exists) {
            showProfileDialog.value = false;
        }
    }
);

provide(EDITOR_ACTIONS_KEY, { deleteSelection: deleteSelectionConfirmed, chooseProfile });

// --- focus requests from other Stage tabs (Controllers → fixture link) ----------------------------------------

watch(
    [focusRequest, overlay],
    ([id, editorOverlay]) => {
        if (!id || !editorOverlay) {
            return;
        }
        if (store.scene.objects[id]) {
            store.select([id]);
            // after the selection reached the viewport
            void nextTick(() => editorOverlay.focusSelection());
        }
        focusRequest.value = null;
    },
    { immediate: true }
);

/** Double-click / Enter on a library tile: the surface point in the viewport center, the origin if nothing is hit. */
function addAssetAtCenter(assetId: string) {
    const hit = overlay.value?.surfaceHitAt({ x: 0, y: 0 }) ?? null;
    addAssetById(store, assetId, hit);
}

// --- context menu ----------------------------------------------------------------------------------------------

function showContextMenu(event: MouseEvent) {
    contextMenu.value?.show(event);
}

const contextMenuItems = computed<MenuItem[]>(() => {
    const selected = store.selection.map((id) => store.scene.objects[id]).filter((o) => !!o);
    const anyVisible = selected.some((o) => o.visible);
    const anyLocked = selected.some((o) => o.locked);
    const hasSelection = selected.length > 0;
    const axisItems = (action: (axis: "x" | "y" | "z") => void) =>
        (["x", "y", "z"] as const).map((axis) => ({ label: axis.toUpperCase(), command: () => action(axis) }));

    const items: MenuItem[] = [
        { label: "Duplicate", icon: "mdi mdi-content-duplicate", disabled: !hasSelection, command: () => store.duplicateSelection() },
        { label: "Copy", icon: "mdi mdi-content-copy", disabled: !hasSelection, command: () => store.copySelection() },
        { label: "Paste", icon: "mdi mdi-content-paste", disabled: !store.clipboard, command: () => store.pasteClipboard() },
        { label: "Delete", icon: "mdi mdi-delete", disabled: !hasSelection, command: () => deleteSelectionConfirmed() },
        { separator: true },
        {
            label: anyVisible ? "Hide" : "Show",
            icon: anyVisible ? "mdi mdi-eye-off" : "mdi mdi-eye",
            disabled: !hasSelection,
            command: () => store.setSelectionVisible(!anyVisible),
        },
        {
            label: anyLocked ? "Unlock" : "Lock",
            icon: anyLocked ? "mdi mdi-lock-open-variant-outline" : "mdi mdi-lock",
            disabled: !hasSelection,
            command: () => store.setLocked([...store.selection], !anyLocked),
        },
        { label: "Focus", icon: "mdi mdi-crosshairs-gps", disabled: !hasSelection, command: () => overlay.value?.focusSelection() },
        { label: "Unparent", icon: "mdi mdi-link-off", disabled: !selected.some((o) => o.parentId !== null), command: () => store.unparentSelection() },
        { separator: true },
        { label: "Align to active", disabled: selected.length < 2, items: axisItems((axis) => store.alignSelection(axis)) },
        { label: "Distribute evenly", disabled: selected.length < 3, items: axisItems((axis) => store.distributeSelection(axis)) },
    ];

    return items;
});
</script>

<style scoped>
.scene-editor {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
}

.panes {
    flex: 1;
    min-height: 0;
}

.left-column {
    height: 100%;
}

.panes :deep(.splitpanes__pane) {
    background: transparent;
    overflow: hidden;
}
</style>
