<template>
    <n-el class="container" @click="onClick">
        <div class="selected-indicator" :class="{ '--selected': selected }"></div>
        <n-spin :show="item.loading" size="small">
            <div class="library-item px-3 py-2" :class="{ '--selected': selected }" draggable="true" @dragstart="dragstart">
                {{ item.name }}
            </div>
        </n-spin>
    </n-el>
</template>

<script setup lang="ts">
import { computed, inject, Ref } from "vue";
import { NEl, NSpin } from "naive-ui";
import { LibraryItem } from "./libraryItem";

const props = defineProps({
    item: { type: Object as () => LibraryItem, required: true },
});

const selectedLibraryItemId: Ref<string> = inject("selectedLibraryItemId")!;

const selected = computed(() => selectedLibraryItemId.value === props.item.id);

function onClick() {
    if (selectedLibraryItemId.value === props.item.id) {
        selectedLibraryItemId.value = "";
    } else {
        selectedLibraryItemId.value = props.item.id;
    }
}

function dragstart(ev: DragEvent) {
    console.log("DAAAAG");
    ev.dataTransfer!.setData("id", props.item.id);
}
</script>

<style scoped>
.container {
    display: grid;
}

.library-item {
    border: 1px solid transparent;
    cursor: pointer;
    grid-area: 1 / 1 / 1 / 1;
    background-color: transparent;
    border-radius: var(--n-border-radius);
    z-index: 1;
    transition: border-color 0.1s linear;
    display: flex;
    align-items: center;
}

.library-item:hover {
    border-color: var(--primary-color);
}

.selected-indicator {
    width: 100%;
    height: 100%;
    background-color: transparent;
    opacity: 0.3;
    border-radius: var(--n-border-radius);
    grid-area: 1 / 1 / 1 / 1;
    transition: background-color 0.1s linear;
}

.selected-indicator.--selected {
    background-color: var(--primary-color);
}
</style>
