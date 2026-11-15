<template>
    <Select
        :model-value="modelValue"
        :options="options"
        option-label="label"
        option-value="value"
        option-disabled="disabled"
        :disabled="disabled"
        placeholder="Choose a model"
        size="small"
        fluid
        @update:model-value="(v: string) => emit('update:modelValue', v)"
    >
        <template #value="{ value, placeholder }">
            <div v-if="value" class="model-option model-value">
                <img v-if="previewOf(value)" :src="previewOf(value)" alt="" class="model-preview" @error="hidePreview" />
                <span>{{ labelOf(value) }}</span>
            </div>
            <span v-else>{{ placeholder }}</span>
        </template>
        <template #option="{ option }">
            <div class="model-option">
                <img v-if="option.preview" :src="option.preview" alt="" class="model-preview" @error="hidePreview" />
                <span>{{ option.label }}</span>
            </div>
        </template>
    </Select>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Select from "primevue/select";

import { assetCatalog } from "@/assetLibrary/catalog";
import type { VisualizationType } from "@/visualization/fixtureVisualization";

/** Fixture model select with a small preview per model (feature 002, contracts/library-ui.md). */
const props = defineProps<{
    modelValue: string | null;
    type: VisualizationType | null;
    disabled?: boolean;
}>();

const emit = defineEmits<{
    "update:modelValue": [modelId: string];
}>();

interface ModelOption {
    label: string;
    value: string;
    preview: string;
    disabled: boolean;
}

const options = computed<ModelOption[]>(() => {
    const list: ModelOption[] = props.type
        ? assetCatalog.modelsFor(props.type).map((def) => ({ label: def.name, value: def.id, preview: def.preview, disabled: false }))
        : [];
    // an unknown model (newer project file) stays visible, but cannot be chosen again
    if (props.modelValue && !list.some((o) => o.value === props.modelValue)) {
        const def = assetCatalog.get(props.modelValue);
        list.push({ label: def?.name ?? props.modelValue, value: props.modelValue, preview: def?.preview ?? "", disabled: true });
    }
    return list;
});

function labelOf(id: string): string {
    return options.value.find((o) => o.value === id)?.label ?? id;
}

function previewOf(id: string): string {
    return options.value.find((o) => o.value === id)?.preview ?? "";
}

function hidePreview(event: Event) {
    (event.target as HTMLImageElement).style.visibility = "hidden";
}
</script>

<style scoped>
.model-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.model-value {
    min-width: 0;
}

.model-value span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.model-value .model-preview {
    width: 24px;
    height: 24px;
}

.model-preview {
    width: 32px;
    height: 32px;
    object-fit: contain;
    flex-shrink: 0;
}
</style>
