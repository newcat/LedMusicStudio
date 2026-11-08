<template>
    <div ref="root" class="scene-editor">
        <EditorToolbar :overlay="overlay" @add="onAdd" @undo="undo" @redo="redo" />
        <splitpanes class="panes">
            <pane size="18" min-size="10">
                <splitpanes horizontal class="left-column">
                    <pane size="50" min-size="15">
                        <Outliner ref="outliner" @contextmenu="showContextMenu" />
                    </pane>
                    <pane size="50" min-size="15">
                        <AssetLibraryPanel @add="addAssetAtCenter" />
                    </pane>
                </splitpanes>
            </pane>
            <pane size="62" min-size="20">
                <Viewport ref="viewport" @contextmenu="showContextMenu" />
            </pane>
            <pane size="20" min-size="12">
                <Inspector />
            </pane>
        </splitpanes>
        <ContextMenu ref="contextMenu" :model="contextMenuItems" />
        <AddFixtureVisualizationDialog v-model:visible="showAddFixtureDialog" @confirm="addFixtureVisualization" />
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Splitpanes, Pane } from "splitpanes";
import ContextMenu from "primevue/contextmenu";
import type { MenuItem } from "primevue/menuitem";
import { useFocusWithin } from "@vueuse/core";

import { activeStageTab, selectedFixtureId, STAGE_TAB_FIXTURES } from "@/views/stageViewState";
import { useStage } from "@/stage/stage";
import type { VisualizationType } from "@/visualization/fixtureVisualization";
import { useScene } from "../sceneStore";
import { modelScaleForFixture, preselectionOf } from "../fixtureModels";
import { isFixtureVisualization } from "../model/types";
import EditorToolbar, { type AddKind } from "./EditorToolbar.vue";
import Outliner from "./Outliner.vue";
import Viewport from "./Viewport.vue";
import Inspector from "./Inspector.vue";
import AddFixtureVisualizationDialog from "./AddFixtureVisualizationDialog.vue";
import AssetLibraryPanel from "./library/AssetLibraryPanel.vue";
import { addAssetById } from "./assetDrop";
import { importModelFile } from "./modelImport";
import { useEditorShortcuts } from "./useEditorShortcuts";

const store = useScene();
const stage = useStage();

const root = ref<HTMLElement>();
const viewport = ref<InstanceType<typeof Viewport>>();
const outliner = ref<InstanceType<typeof Outliner>>();
const contextMenu = ref<InstanceType<typeof ContextMenu>>();
const showAddFixtureDialog = ref(false);

const overlay = computed(() => viewport.value?.overlay ?? null);
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
    delete: () => store.deleteSelection(),
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
    rename: () => outliner.value?.startRename(),
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
        case "fixture":
            showAddFixtureDialog.value = true;
            break;
        case "model":
            void importModelFile(store, hit);
            break;
    }
}

/** The scale comes from the preselection for the mapped model, otherwise it is recomputed for the chosen one. */
function addFixtureVisualization(fixtureId: string, type: VisualizationType, modelId: string) {
    const hit = overlay.value?.getLastSurfaceHit();
    const fixture = stage.fixtures.get(fixtureId);
    const preselection = preselectionOf(fixture);
    const modelScale = preselection?.modelId === modelId ? preselection.modelScale : modelScaleForFixture(fixture, modelId);
    store.addFixtureVisualization(fixtureId, type, hit ? { position: hit.point } : undefined, { modelId, modelScale });
}

/** Double-click / Enter on a library tile: the surface point in the viewport center, the origin if nothing is hit. */
function addAssetAtCenter(assetId: string) {
    const hit = overlay.value?.surfaceHitAt({ x: 0, y: 0 }) ?? null;
    addAssetById(store, assetId, hit);
}

// --- cross-view selection (FR-026) -----------------------------------------------------------------------------

watch(
    () => store.activeId,
    (id) => {
        const obj = id ? store.scene.objects[id] : undefined;
        if (obj && isFixtureVisualization(obj) && obj.fixtureId) {
            selectedFixtureId.value = obj.fixtureId;
        }
    }
);

// --- context menu ----------------------------------------------------------------------------------------------

function showContextMenu(event: MouseEvent) {
    contextMenu.value?.show(event);
}

const contextMenuItems = computed<MenuItem[]>(() => {
    const selected = store.selection.map((id) => store.scene.objects[id]).filter((o) => !!o);
    const active = store.activeId ? store.scene.objects[store.activeId] : undefined;
    const anyVisible = selected.some((o) => o.visible);
    const anyLocked = selected.some((o) => o.locked);
    const hasSelection = selected.length > 0;
    const axisItems = (action: (axis: "x" | "y" | "z") => void) =>
        (["x", "y", "z"] as const).map((axis) => ({ label: axis.toUpperCase(), command: () => action(axis) }));

    const items: MenuItem[] = [
        { label: "Duplicate", icon: "mdi mdi-content-duplicate", disabled: !hasSelection, command: () => store.duplicateSelection() },
        { label: "Copy", icon: "mdi mdi-content-copy", disabled: !hasSelection, command: () => store.copySelection() },
        { label: "Paste", icon: "mdi mdi-content-paste", disabled: !store.clipboard, command: () => store.pasteClipboard() },
        { label: "Delete", icon: "mdi mdi-delete", disabled: !hasSelection, command: () => store.deleteSelection() },
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

    if (active && isFixtureVisualization(active)) {
        items.push(
            { separator: true },
            {
                label: "Open fixture settings",
                icon: "mdi mdi-lamp",
                disabled: !active.fixtureId,
                command: () => {
                    selectedFixtureId.value = active.fixtureId;
                    activeStageTab.value = STAGE_TAB_FIXTURES;
                },
            }
        );
    }
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

.panes :deep(.splitpanes__pane) {
    background: transparent;
    overflow: hidden;
}
</style>
