<template>
    <div class="look-preview" :class="{ '--compact': compact }">
        <span class="__swatch" :style="{ background: swatch }"></span>
        <span class="__label">{{ count }} attribute{{ count === 1 ? "" : "s" }}<template v-if="fanTiming > 0"> · fan {{ Math.round(fanTiming * 100) }} %</template></span>
        <span v-if="!compact && targetText" class="__target">→ {{ targetText }}</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { LibraryItem } from "@/library/libraryItem";
import type { Item } from "@/timeline/model/item";
import type { Rgb } from "../attributes";
import { rgbToHex } from "../color";
import { targetLabel } from "../targets";
import type { LookLibraryItem } from "./Look.libraryItem";

const props = defineProps<{
    item?: Item;
    libraryItem?: LibraryItem;
    unitWidth?: number;
    compact?: boolean;
}>();

const look = computed(() => ((props.item?.libraryItem ?? props.libraryItem) as LookLibraryItem).state);
const count = computed(() => Object.keys(look.value.values).length);
const fanTiming = computed(() => look.value.fanTiming);

const swatch = computed(() => {
    const color = look.value.values.color;
    if (color?.kind === "single") {
        return rgbToHex(color.value as Rgb);
    }
    if (color?.kind === "fan") {
        return `linear-gradient(90deg, ${rgbToHex(color.from as Rgb)}, ${rgbToHex(color.to as Rgb)})`;
    }
    return "transparent";
});

const targetText = computed(() => (props.item ? targetLabel(props.item.target) : ""));
</script>

<style scoped>
.look-preview {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.2rem 0.4rem;
    font-size: 0.7rem;
    color: var(--p-text-color);
    white-space: nowrap;
    overflow: hidden;
}
.__swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid var(--p-content-border-color);
    flex: none;
}
.__target {
    opacity: 0.7;
}
</style>
