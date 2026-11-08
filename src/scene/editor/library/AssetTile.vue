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
    align-items: center;
    gap: 0.25rem;
    padding: 0.35rem;
    border-radius: 6px;
    cursor: grab;
    user-select: none;
    outline: none;
    border: 1px solid transparent;
}

.asset-tile:hover {
    background: var(--p-content-hover-background, rgba(255, 255, 255, 0.06));
}

.asset-tile:focus-visible,
.asset-tile.selected {
    border-color: var(--p-primary-color, #38bdf8);
}

.thumb {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
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

.name {
    font-size: 0.75rem;
    text-align: center;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
}
</style>
