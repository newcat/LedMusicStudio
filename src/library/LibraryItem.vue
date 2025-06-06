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
        <div class="grow">{{ item.name }}</div>
        <div>
            <i class="pi pi-ellipsis-v" @click.stop="menu?.toggle"></i>
            <Menu ref="menu" :model="popupMenu" :popup="true" />
        </div>
        <LibraryItemSettings v-model="showItemSettings" :item="item" />
    </div>
</template>

<script setup lang="ts">
import { ComponentInstance, computed, ref } from "vue";
import Menu, { MenuProps } from "primevue/menu";

import { useLibrary } from "./libraryModel";
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
        command: () => {
            void library.removeItem(item.value!);
        },
    },
];
const showItemSettings = ref(false);

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
