<template>
    <div class="effect-preview" :class="{ '--compact': compact }">
        <svg viewBox="0 0 40 20" class="__shape" preserveAspectRatio="none">
            <polyline :points="points" fill="none" stroke="currentColor" stroke-width="1.5" />
        </svg>
        <span class="__label">{{ label }}</span>
        <span v-if="!compact && targetText" class="__target">→ {{ targetText }}</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { LibraryItem } from "@/library/libraryItem";
import type { Item } from "@/timeline/model/item";
import { evaluateShape } from "../effects";
import { EFFECT_ATTRIBUTES, EFFECT_SHAPES } from "../states";
import { targetLabel } from "../targets";
import type { EffectLibraryItem } from "./Effect.libraryItem";

const props = defineProps<{
    item?: Item;
    libraryItem?: LibraryItem;
    unitWidth?: number;
    compact?: boolean;
}>();

const effect = computed(() => ((props.item?.libraryItem ?? props.libraryItem) as EffectLibraryItem).state);

/** One cycle of the shape; circle/figure-8 show their tilt component. */
const points = computed(() => {
    const result: string[] = [];
    for (let i = 0; i <= 40; i++) {
        const v = evaluateShape(effect.value.shape, i / 40);
        const y = Array.isArray(v) ? v[1] : v;
        result.push(`${i},${10 - y * 8}`);
    }
    return result.join(" ");
});

const label = computed(() => {
    const attribute = EFFECT_ATTRIBUTES.find((a) => a.value === effect.value.attribute)?.label ?? effect.value.attribute;
    const shape = EFFECT_SHAPES.find((s) => s.value === effect.value.shape)?.label ?? effect.value.shape;
    return `${attribute} · ${shape} · ${effect.value.rateBeats} beat${effect.value.rateBeats === 1 ? "" : "s"}`;
});

const targetText = computed(() => (props.item ? targetLabel(props.item.target) : ""));
</script>

<style scoped>
.effect-preview {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.2rem 0.4rem;
    font-size: 0.7rem;
    color: var(--p-text-color);
    white-space: nowrap;
    overflow: hidden;
}
.__shape {
    width: 32px;
    height: 16px;
    flex: none;
    color: var(--p-primary-color);
}
.__target {
    opacity: 0.7;
}
.--compact .__label {
    opacity: 0.8;
}
</style>
