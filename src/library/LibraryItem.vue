<template>
    <div v-if="item" class="library-item" draggable="true" @dragstart="dragstart">
        <div v-if="item.loading" class="__loading-indicator">
            <i class="pi pi-spin pi-spinner"></i>
        </div>
        <div class="__title">{{ item.name }}</div>
        <div class="__menu">
            <i class="pi pi-ellipsis-v"></i>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useLibrary } from "./libraryModel";

const props = defineProps<{
    itemId: string;
}>();

const library = useLibrary();

const item = library.items.find((it) => it.id === props.itemId);

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

.library-item > .__menu {
}
</style>
