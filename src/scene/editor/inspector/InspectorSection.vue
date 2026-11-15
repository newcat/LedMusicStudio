<template>
    <section ref="root" class="inspector-section" :class="{ collapsed: !isOpen }">
        <div class="section-header">
            <button type="button" class="section-toggle" :aria-expanded="isOpen" @click="toggle">
                <i :class="isOpen ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" class="chevron" aria-hidden="true"></i>
                <span class="section-title">{{ title }}</span>
                <span v-if="!isOpen && $slots.summary" class="section-summary"><slot name="summary"></slot></span>
            </button>
            <div v-if="$slots.actions" class="section-actions">
                <slot name="actions"></slot>
            </div>
        </div>
        <div v-show="isOpen" class="section-content">
            <slot></slot>
        </div>
    </section>
</template>

<script lang="ts">
import { useLocalStorage } from "@vueuse/core";

/** Open state of all inspector sections, per user (data-model → Inspector section state). Shared by all instances. */
const sectionState = useLocalStorage<Record<string, boolean>>("lms.inspectorSections", {});
</script>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";

/**
 * Collapsible inspector section (feature 006, research R10). The actions slot sits outside the toggle button, so
 * it can hold buttons without nesting them.
 */
const props = withDefaults(
    defineProps<{
        /** persistence key */
        name: string;
        title: string;
        defaultOpen?: boolean;
    }>(),
    { defaultOpen: true }
);

const root = ref<HTMLElement>();

const isOpen = computed(() => sectionState.value[props.name] ?? props.defaultOpen);

function setOpen(open: boolean) {
    sectionState.value = { ...sectionState.value, [props.name]: open };
}

function toggle() {
    setOpen(!isOpen.value);
}

function open() {
    setOpen(true);
}

/** Opens the section and scrolls it into view (validation summary). */
async function reveal() {
    open();
    await nextTick();
    root.value?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

defineExpose({ open, reveal });
</script>

<style scoped>
.inspector-section {
    border-bottom: 1px solid var(--p-content-border-color);
}

.section-header {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 var(--insp-gap-3, 12px);
    gap: var(--insp-gap-2, 8px);
}

.section-toggle {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--insp-gap-2, 8px);
    height: 100%;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
}

.section-toggle:focus-visible {
    outline: 1px solid var(--p-primary-color);
    outline-offset: -1px;
}

.chevron {
    font-size: 0.7rem;
    opacity: 0.7;
}

.section-title {
    white-space: nowrap;
}

.section-summary {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 400;
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
}

.section-actions {
    display: flex;
    align-items: center;
    gap: var(--insp-gap-1, 4px);
    flex-shrink: 0;
}

.section-content {
    display: flex;
    flex-direction: column;
    gap: var(--insp-gap-2, 8px);
    padding: var(--insp-gap-2, 8px) var(--insp-gap-3, 12px) var(--insp-gap-3, 12px);
    min-width: 0;
}
</style>
