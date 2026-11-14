<template>
    <div class="preset-preview">
        <span class="__swatch" :style="{ background: swatch }"></span>
        <span>{{ summary }}</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { LibraryItem } from "@/library/libraryItem";
import type { Rgb } from "../attributes";
import { rgbToHex } from "../color";
import { PRESET_KIND_LABELS } from "../states";
import type { PresetLibraryItem } from "./Preset.libraryItem";

const props = defineProps<{ libraryItem: LibraryItem; compact?: boolean }>();

const preset = computed(() => (props.libraryItem as PresetLibraryItem).state);

const summary = computed(() => {
    const kind = PRESET_KIND_LABELS[preset.value.presetKind];
    if (preset.value.aimTargetId) {
        return `${kind} · aim`;
    }
    const perFixture = Object.keys(preset.value.perFixture).length;
    return `${kind} · ${Object.keys(preset.value.common).length} common${perFixture > 0 ? ` · ${perFixture} fixtures` : ""}`;
});

const swatch = computed(() => (preset.value.common.color ? rgbToHex(preset.value.common.color as Rgb) : "transparent"));
</script>

<style scoped>
.preset-preview {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.7rem;
    opacity: 0.8;
}
.__swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex: none;
}
</style>
