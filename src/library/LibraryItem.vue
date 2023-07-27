<template>
    <div v-if="item" class="library-item" draggable="true" @dragstart="dragstart">
        <div v-if="item.loading" class="__loading-indicator">
            <i class="pi pi-spin pi-spinner"></i>
        </div>
        <div class="__title">{{ item.name }}</div>
        <div class="__menu">
            <i class="pi pi-ellipsis-v" @click.stop="menu?.toggle"></i>
            <Menu ref="menu" :model="popupMenu" :popup="true" />
        </div>
        <LibraryItemSettings v-model="showItemSettings" :item="item" />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Menu, { MenuProps } from "primevue/menu";

import { useLibrary } from "./libraryModel";
import LibraryItemSettings from "./LibraryItemSettings.vue";

const props = defineProps<{
    itemId: string;
}>();

const library = useLibrary();

const item = computed(() => library.items.find((it) => it.id === props.itemId));

const menu = ref<Menu | null>(null);
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
            library.duplicateItem(item.value!);
        },
    },
    {
        label: "Delete",
        icon: "mdi mdi-delete",
        command: () => {
            library.removeItem(item.value!);
        },
    },
];
const showItemSettings = ref(false);

function dragstart(ev: DragEvent) {
    ev.dataTransfer!.setData("id", props.itemId);
}
</script>

<style scoped>
.library-item {
    display: flex;
    margin-left: 1.35rem;
    align-items: center;
}

.library-item > .__loading-indicator {
    margin-right: 1rem;
}

.library-item > .__title {
    flex-grow: 1;
}
</style>
