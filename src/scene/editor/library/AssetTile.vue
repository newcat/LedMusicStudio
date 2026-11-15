<template>
    <div
        v-tooltip.bottom="{ value: tooltip, showDelay: 400 }"
        class="asset-tile"
        :class="{ selected }"
        tabindex="0"
        :draggable="draggable"
        role="button"
        :aria-label="asset.name"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
        @click="emit('select', asset.id)"
        @dblclick="emit('activate', asset.id)"
        @keydown.enter.prevent="emit('activate', asset.id)"
    >
        <div class="thumb">
            <img v-if="!imageFailed" :src="asset.preview" :alt="asset.name" loading="lazy" draggable="false" @error="imageFailed = true" />
            <i v-else class="pi" :class="CATEGORY_ICONS[asset.category]"></i>
        </div>
        <div class="name">{{ asset.name }}</div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AssetCategory, AssetDefinition } from "@/assetLibrary/types";
import { ASSET_DRAG_TYPE, setCurrentDragAssetId } from "../assetDrop";

const props = withDefaults(
    defineProps<{
        asset: AssetDefinition;
        draggable?: boolean;
        selected?: boolean;
    }>(),
    { draggable: true, selected: false }
);

const emit = defineEmits<{
    activate: [assetId: string];
    select: [assetId: string];
}>();

const CATEGORY_ICONS: Record<AssetCategory, string> = {
    fixtures: "pi-lightbulb",
    stage: "pi-box",
    decoration: "pi-star",
    shapes: "pi-stop",
};

const imageFailed = ref(false);
watch(
    () => props.asset.preview,
    () => (imageFailed.value = false)
);

const tooltip = computed(() => `${props.asset.name} · ${props.asset.defaultSize[1].toFixed(2)} m high`);

function onDragStart(event: DragEvent) {
    if (!props.draggable || !event.dataTransfer) {
        return;
    }
    event.dataTransfer.setData(ASSET_DRAG_TYPE, props.asset.id);
    event.dataTransfer.effectAllowed = "copy";
    setCurrentDragAssetId(props.asset.id);
}

function onDragEnd() {
    setCurrentDragAssetId(null);
}
</script>

<style scoped>
.asset-tile {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.375rem;
    min-width: 0;
    cursor: grab;
    user-select: none;
    outline: none;
}

/* the thumbnail sits on a soft tile, so dark models read against the dark panel */
.thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    padding: 0.5rem;
    border: 1px solid transparent;
    border-radius: 8px;
    background: color-mix(in srgb, var(--p-text-color) 5%, transparent);
    transition: background-color 0.15s, border-color 0.15s;
}

.asset-tile:hover .thumb {
    background: color-mix(in srgb, var(--p-text-color) 10%, transparent);
}

.asset-tile:focus-visible .thumb,
.asset-tile.selected .thumb {
    border-color: var(--p-primary-color, #38bdf8);
}

.thumb img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
}

.thumb .pi {
    font-size: 2rem;
    opacity: 0.6;
}

/* two lines instead of an ellipsis; the fixed height keeps the rows aligned */
.name {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    height: calc(2 * 1.25em);
    overflow: hidden;
    padding: 0 0.125rem;
    color: var(--p-text-muted-color);
    font-size: 0.75rem;
    line-height: 1.25;
    text-align: center;
    overflow-wrap: break-word;
    transition: color 0.15s;
}

.asset-tile:hover .name,
.asset-tile.selected .name {
    color: var(--p-text-color);
}
</style>
