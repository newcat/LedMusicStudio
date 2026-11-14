<template>
    <div
        v-if="item"
        class="library-item"
        :class="{ '--selected': library.selectedItemId === itemId }"
        draggable="true"
        @dragstart="dragstart"
        @click="selectItem"
    >
        <div v-if="item.loading" class="mr-4"><i class="pi pi-spin pi-spinner"></i></div>
        <div v-else-if="item.error" class="mr-4" :title="item.error"><i class="mdi mdi-alert"></i></div>
        <div class="grow min-w-0">
            <div>{{ item.name }}</div>
            <component :is="previewOf(item.type)" v-if="previewOf(item.type)" :library-item="item" compact />
        </div>
        <div>
            <i class="pi pi-ellipsis-v" @click.stop="menu?.toggle"></i>
            <Menu ref="menu" :model="popupMenu" :popup="true" />
        </div>
        <LibraryItemSettings v-model="showItemSettings" :item="item" />
        <ConfirmDialog v-if="isPresetLibraryItem(item)" :group="confirmGroup" />
    </div>
</template>

<script setup lang="ts">
import { ComponentInstance, computed, ref } from "vue";
import Menu, { MenuProps } from "primevue/menu";
import ConfirmDialog from "primevue/confirmdialog";
import { useConfirm } from "primevue/useconfirm";
import { isPresetLibraryItem } from "@/programming/guards";
import { lookUsesOfPreset } from "@/programming/uses";
import { bakePresetIntoLooks } from "@/programming/preset/bake";

import { useLibrary } from "./libraryModel";
import { LibraryItemType } from "./libraryItem";
import EffectPreview from "@/programming/effect/EffectPreview.vue";
import LookPreview from "@/programming/look/LookPreview.vue";
import PresetPreview from "@/programming/preset/PresetPreview.vue";
import LibraryItemSettings from "./LibraryItemSettings.vue";

const props = defineProps<{
    itemId: string;
}>();

const library = useLibrary();

const item = computed(() => library.items.find((it) => it.id === props.itemId));

const menu = ref<ComponentInstance<typeof Menu> | null>(null);
const popupMenu: MenuProps["model"] = [
    {
        label: "Rename",
        icon: "mdi mdi-pencil",
        command: () => {
            showItemSettings.value = true;
        },
    },
    {
        label: "Duplicate",
        icon: "mdi mdi-content-copy",
        command: () => {
            void library.duplicateItem(item.value!);
        },
    },
    {
        label: "Delete",
        icon: "mdi mdi-delete",
        command: () => deleteItem(),
    },
];
const showItemSettings = ref(false);
const confirm = useConfirm();
const confirmGroup = `delete-preset-${props.itemId}`;

/** Presets used by looks ask first; on confirm the looks keep the preset's values (FR-031, R10). */
function deleteItem() {
    const current = item.value;
    if (!current) {
        return;
    }
    const uses = isPresetLibraryItem(current) ? lookUsesOfPreset(current.id) : [];
    if (!isPresetLibraryItem(current) || uses.length === 0) {
        void library.removeItem(current);
        return;
    }
    confirm.require({
        group: confirmGroup,
        header: "Delete preset",
        message: `"${current.name}" is used by ${uses.length} look${uses.length === 1 ? "" : "s"} (${uses.length} use${uses.length === 1 ? "" : "s"}). The looks keep the preset's current values. Delete anyway?`,
        icon: "pi pi-exclamation-triangle",
        acceptLabel: "Delete",
        rejectLabel: "Cancel",
        accept: () => {
            bakePresetIntoLooks(current.id, current.state, uses);
            void library.removeItem(current);
        },
    });
}

/** Small summary under the name (feature 004 items). */
function previewOf(type: LibraryItemType) {
    return type === LibraryItemType.EFFECT ? EffectPreview : type === LibraryItemType.LOOK ? LookPreview : type === LibraryItemType.PRESET ? PresetPreview : null;
}

function dragstart(ev: DragEvent) {
    ev.dataTransfer!.setData("id", props.itemId);
}

function selectItem() {
    library.selectedItemId = props.itemId;
}
</script>

<style scoped>
.library-item {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    cursor: pointer;
    border-radius: var(--p-content-border-radius);
    transition:
        background var(--p-transition-duration),
        border-color var(--p-transition-duration);
    border: 1px solid transparent;
}

.library-item.--selected {
    background-color: var(--p-highlight-background);
}

.library-item:hover {
    border-color: var(--p-primary-hover-color);
}

.status-indicator {
    margin-right: 1rem;
}
</style>
