<template>
    <div class="property-row">
        <label class="property-label" :for="props.for" :title="label">{{ label }}</label>
        <div class="property-control">
            <slot></slot>
            <div v-if="hint || $slots.hint" class="property-hint"><slot name="hint">{{ hint }}</slot></div>
            <div v-if="warning" class="property-warning">{{ warning }}</div>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * One labelled row of the inspector (feature 006, research R11/R12): label | control in a two-column grid that
 * becomes one column when the inspector is narrower than 280 px.
 *
 * Convention: controls inside use PrimeVue's built-in `size="small"` and `fluid`, so they fill the control cell and
 * shrink with it (the theme's component variables cannot be overridden per container).
 */
const props = defineProps<{
    label: string;
    /** muted line under the control */
    hint?: string;
    /** orange line under the control */
    warning?: string;
    /** id of the control the label belongs to */
    for?: string;
}>();
</script>

<style scoped>
.property-row {
    display: grid;
    grid-template-columns: minmax(5.5rem, 35%) minmax(0, 1fr);
    column-gap: var(--insp-gap-2, 8px);
    align-items: start;
}

.property-label {
    font-size: 0.8125rem;
    color: var(--p-text-muted-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* vertically centred to a small control (2rem high) */
    line-height: 2rem;
}

.property-control {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.property-hint {
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
}

.property-warning {
    font-size: 0.75rem;
    color: var(--p-orange-400);
}

@container inspector (max-width: 280px) {
    .property-row {
        grid-template-columns: minmax(0, 1fr);
    }

    .property-label {
        line-height: 1.5rem;
    }
}
</style>
