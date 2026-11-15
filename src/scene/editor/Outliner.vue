<template>
    <div class="outliner-panel">
        <div class="header">
            <span class="title">Scene</span>
            <Button v-tooltip.bottom="'Add'" icon="pi pi-plus" text rounded size="small" aria-label="Add" aria-haspopup="true" @click="addMenu?.toggle($event)" />
            <Menu ref="addMenu" :model="addItems" popup />
        </div>
        <div class="outliner" @dragover.prevent="onRootDragOver" @drop.prevent="onRootDrop" @click.self="store.clearSelection()">
            <Tree
                v-model:expanded-keys="expandedKeys"
                :value="nodes"
                class="outliner-tree"
                :pt="treePt"
            >
                <template #default="{ node }">
                    <div
                        class="row"
                        :class="{
                            selected: store.selection.includes(node.key),
                            hidden: !node.data.visible,
                            active: store.activeId === node.key,
                            'drop-into': dropTarget?.id === node.key && dropTarget.zone === 'into',
                            'drop-before': dropTarget?.id === node.key && dropTarget.zone === 'before',
                            'drop-after': dropTarget?.id === node.key && dropTarget.zone === 'after',
                        }"
                        draggable="true"
                        @click.stop="onRowClick($event, node.key)"
                        @dblclick.stop="startRename(node.key)"
                        @contextmenu.prevent.stop="onRowContextMenu($event, node.key)"
                        @dragstart="onDragStart($event, node.key)"
                        @dragover.prevent.stop="onDragOver($event, node.key)"
                        @dragleave="dropTarget = null"
                        @drop.prevent.stop="onDrop($event, node.key)"
                        @dragend="dropTarget = null"
                    >
                        <i :class="['mdi', iconFor(node.data)]"></i>
                        <InputText
                            v-if="renamingId === node.key"
                            ref="renameInput"
                            v-model="renameDraft"
                            size="small"
                            class="rename"
                            @click.stop
                            @keydown.enter.stop="commitRename"
                            @keydown.esc.stop="renamingId = null"
                            @blur="commitRename"
                        />
                        <span v-else class="name">{{ node.label }}</span>
                        <i
                            :class="['mdi toggle', node.data.visible ? 'mdi-eye' : 'mdi-eye-off']"
                            :title="node.data.visible ? 'Hide' : 'Show'"
                            @click.stop="store.setVisible([node.key], !node.data.visible)"
                        ></i>
                        <i
                            :class="['mdi toggle', node.data.locked ? 'mdi-lock' : 'mdi-lock-open-variant-outline']"
                            :title="node.data.locked ? 'Unlock' : 'Lock'"
                            @click.stop="store.setLocked([node.key], !node.data.locked)"
                        ></i>
                    </div>
                </template>
            </Tree>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import Tree from "primevue/tree";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Menu from "primevue/menu";
import type { TreeNode } from "primevue/treenode";

import { useScene } from "../sceneStore";
import { wouldCreateCycle } from "../model/transformMath";
import { iconFor } from "./objectIcons";
import { addMenuItems, type AddKind } from "./addMenu";

const emit = defineEmits<{
    contextmenu: [MouseEvent];
    add: [kind: AddKind];
}>();

type DropZone = "before" | "into" | "after";

const store = useScene();

const expandedKeys = ref<Record<string, boolean>>({});
const renamingId = ref<string | null>(null);
const renameDraft = ref("");
const renameInput = ref<Array<{ $el: HTMLInputElement }>>();
const dropTarget = ref<{ id: string; zone: DropZone } | null>(null);
let draggedIds: string[] = [];

function buildNode(id: string): TreeNode | null {
    const obj = store.scene.objects[id];
    if (!obj) {
        return null;
    }
    return {
        key: id,
        label: obj.name,
        data: obj,
        children: obj.children.map(buildNode).filter((n): n is TreeNode => n !== null),
    };
}

const nodes = computed(() => store.scene.rootOrder.map(buildNode).filter((n): n is TreeNode => n !== null));

// new groups start expanded
watch(
    () => Object.keys(store.scene.objects),
    (ids) => {
        let changed = false;
        const next = { ...expandedKeys.value };
        for (const id of ids) {
            if (!(id in next)) {
                next[id] = true;
                changed = true;
            }
        }
        if (changed) {
            expandedKeys.value = next;
        }
    },
    { immediate: true }
);

const addMenu = ref<InstanceType<typeof Menu>>();
const addItems = addMenuItems((kind) => emit("add", kind));

/** Tree pass-through: no padding/background, and leaf nodes are marked so their toggle can be hidden. */
const treePt = {
    root: { class: "p-0 bg-transparent border-0" },
    nodeContent: { class: "p-0" },
    nodeToggleButton: ({ context }: { context: { leaf: boolean } }) => ({ class: context.leaf ? "leaf" : undefined }),
};

function onRowClick(event: MouseEvent, id: string) {
    // locked objects can be selected here (they cannot be picked in 3D)
    store.select([id], event.ctrlKey || event.metaKey || event.shiftKey ? "toggle" : "replace");
}

function onRowContextMenu(event: MouseEvent, id: string) {
    if (!store.selection.includes(id)) {
        store.select([id], "replace");
    }
    emit("contextmenu", event);
}

// --- rename ---------------------------------------------------------------------------------------------------

function startRename(id: string | null = store.activeId) {
    const obj = id ? store.scene.objects[id] : undefined;
    if (!id || !obj) {
        return;
    }
    renamingId.value = id;
    renameDraft.value = obj.name;
    void nextTick(() => {
        const input = renameInput.value?.[0]?.$el;
        input?.focus();
        input?.select();
    });
}

function commitRename() {
    const id = renamingId.value;
    renamingId.value = null;
    // rejected when empty after trimming
    if (id && renameDraft.value.trim().length > 0) {
        store.rename(id, renameDraft.value);
    }
}

// --- drag & drop reparenting (FR-033: the world transform is kept by the store) -----------------------------

function onDragStart(event: DragEvent, id: string) {
    draggedIds = store.selection.includes(id) ? [...store.selection] : [id];
    event.dataTransfer?.setData("text/plain", draggedIds.join(","));
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
    }
}

function zoneFor(event: DragEvent): DropZone {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const y = (event.clientY - rect.top) / rect.height;
    return y < 0.25 ? "before" : y > 0.75 ? "after" : "into";
}

function onDragOver(event: DragEvent, id: string) {
    if (draggedIds.length === 0) {
        return;
    }
    dropTarget.value = { id, zone: zoneFor(event) };
}

function onDrop(event: DragEvent, id: string) {
    const zone = zoneFor(event);
    const ids = draggedIds;
    dropTarget.value = null;
    draggedIds = [];
    const target = store.scene.objects[id];
    if (!target || ids.length === 0 || ids.includes(id)) {
        return;
    }
    if (zone === "into") {
        store.reparent(ids, id);
        expandedKeys.value = { ...expandedKeys.value, [id]: true };
        return;
    }
    const parentId = target.parentId;
    // cycles are rejected silently
    if (ids.some((dragged) => wouldCreateCycle(store.scene, dragged, parentId))) {
        return;
    }
    const siblings = parentId ? store.scene.objects[parentId].children : store.scene.rootOrder;
    const index = siblings.indexOf(id) + (zone === "after" ? 1 : 0);
    store.reparent(ids, parentId, index);
}

function onRootDragOver() {
    dropTarget.value = null;
}

function onRootDrop() {
    const ids = draggedIds;
    draggedIds = [];
    if (ids.length > 0) {
        store.reparent(ids, null);
    }
}

defineExpose({ startRename });
</script>

<style scoped>
.outliner-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

/* like the asset library header */
.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.5rem 0.25rem;
}

.title {
    font-weight: 600;
    font-size: 0.9rem;
}

.outliner {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 0.25rem 0.25rem;
}

/* leaf rows get no toggle placeholder; children are indented by a fixed step */
.outliner :deep(.p-tree-node-toggle-button.leaf) {
    display: none;
}

.outliner :deep(.p-tree-node-children) {
    padding-left: 1rem;
}

/* the theme's tree paddings win over utility classes */
.outliner :deep(.p-tree),
.outliner :deep(.p-tree-node-content) {
    padding: 0;
}

.outliner :deep(.p-tree-node-label) {
    flex: 1;
    min-width: 0;
}

.row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    height: 28px;
    padding: 0 8px;
    border-radius: 4px;
    border: 1px solid transparent;
    cursor: default;
    user-select: none;
}

.row:hover {
    background: rgba(255, 255, 255, 0.06);
}

.row.selected {
    background: rgba(79, 195, 247, 0.25);
}

.row.active {
    background: rgba(255, 204, 0, 0.25);
}

.row.hidden .name {
    opacity: 0.4;
}

.row.drop-into {
    border-color: #4fc3f7;
}

.row.drop-before {
    border-top-color: #4fc3f7;
}

.row.drop-after {
    border-bottom-color: #4fc3f7;
}

.name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.rename {
    flex: 1;
    min-width: 0;
}

.toggle {
    opacity: 0.6;
    cursor: pointer;
}

.toggle:hover {
    opacity: 1;
}
</style>
