<template>
    <div v-if="fullWidth" class="effect-preview --full">
        <span class="__label">{{ label }}</span>
        <svg class="__wave" :viewBox="`0 0 ${widthPx} 20`" preserveAspectRatio="none">
            <polyline :points="wavePoints" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" />
        </svg>
    </div>
    <div v-else class="effect-preview" :class="{ '--compact': compact }">
        <svg viewBox="0 0 40 20" class="__shape" preserveAspectRatio="none">
            <polyline :points="points" fill="none" stroke="currentColor" stroke-width="1.5" />
        </svg>
        <span class="__label">{{ label }}</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { LibraryItem } from "@/library/libraryItem";
import type { Item } from "@/timeline/model/item";
import { TICKS_PER_BEAT } from "@/constants";
import { evaluateShape } from "../effects";
import { EFFECT_ATTRIBUTES, EFFECT_SHAPES } from "../states";
import type { EffectLibraryItem } from "./Effect.libraryItem";

const MAX_POINTS = 600;

const props = defineProps<{
    item?: Item;
    libraryItem?: LibraryItem;
    unitWidth?: number;
    compact?: boolean;
}>();

const effect = computed(() => ((props.item?.libraryItem ?? props.libraryItem) as EffectLibraryItem).state);

function shapeY(phase: number): number {
    const v = evaluateShape(effect.value.shape, phase, effect.value.width);
    return Array.isArray(v) ? v[1] : v;
}

/** One cycle of the shape; circle/figure-8 show their tilt component. */
const points = computed(() => {
    const result: string[] = [];
    for (let i = 0; i <= 40; i++) {
        result.push(`${i},${10 - shapeY(i / 40) * 8}`);
    }
    return result.join(" ");
});

/** Timeline clips draw the shape across the whole clip (feature 005, FR-033). */
const fullWidth = computed(() => !props.compact && !!props.item && !!props.unitWidth);
const widthPx = computed(() => (props.item && props.unitWidth ? Math.max(1, (props.item.end - props.item.start) * props.unitWidth) : 1));

const wavePoints = computed(() => {
    if (!fullWidth.value || !props.item) {
        return "";
    }
    const length = props.item.end - props.item.start;
    const cycleTicks = Math.max(1e-6, effect.value.rateBeats * TICKS_PER_BEAT);
    const cycles = length / cycleTicks;
    const w = widthPx.value;
    const n = Math.max(2, Math.min(MAX_POINTS, Math.ceil(w / 3)));
    const result: string[] = [];
    for (let i = 0; i <= n; i++) {
        const f = i / n;
        const phase = (f * cycles) % 1;
        result.push(`${(f * w).toFixed(1)},${(10 - shapeY(phase) * 8).toFixed(2)}`);
    }
    return result.join(" ");
});

const label = computed(() => {
    const attribute = EFFECT_ATTRIBUTES.find((a) => a.value === effect.value.attribute)?.label ?? effect.value.attribute;
    const shape = EFFECT_SHAPES.find((s) => s.value === effect.value.shape)?.label ?? effect.value.shape;
    return `${attribute} · ${shape} · ${effect.value.rateBeats} beat${effect.value.rateBeats === 1 ? "" : "s"}`;
});
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
.effect-preview.--full {
    flex-direction: column;
    align-items: stretch;
    gap: 0.1rem;
    padding: 0.2rem 0;
    height: 100%;
}
.effect-preview.--full .__label {
    padding: 0 0.4rem;
    overflow: hidden;
    text-overflow: ellipsis;
}
.__wave {
    width: 100%;
    flex: 1 1 auto;
    min-height: 12px;
    color: var(--p-primary-color);
}
.__shape {
    width: 32px;
    height: 16px;
    flex: none;
    color: var(--p-primary-color);
}
.--compact .__label {
    opacity: 0.8;
}
</style>
