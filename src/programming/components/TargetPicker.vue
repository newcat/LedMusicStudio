<template>
    <Listbox
        :model-value="selected"
        :options="optionGroups"
        option-label="label"
        option-value="value"
        option-group-label="label"
        option-group-children="items"
        filter
        filter-placeholder="Search targets"
        auto-filter-focus
        scroll-height="16rem"
        class="target-picker"
        @update:model-value="onPick"
    />
</template>

<script setup lang="ts">
import { computed } from "vue";
import Listbox from "primevue/listbox";
import { buildTargetOptions, decodeTargetValue, encodeTargetValue, type TargetSelectValue } from "./TargetSelect.vue";

/** Filterable target list for the clip/track target chip popover (feature 005, R12). */
const props = withDefaults(defineProps<{ modelValue: TargetSelectValue; allowInherit?: boolean }>(), { allowInherit: false });

const emit = defineEmits<{ "update:modelValue": [value: TargetSelectValue]; close: [] }>();

const selected = computed(() => encodeTargetValue(props.modelValue));
const optionGroups = computed(() => buildTargetOptions({ allowInherit: props.allowInherit, allowNone: true }));

function onPick(value: string | null) {
    // clicking the selected entry again deselects it in a Listbox: treat that as picking it again
    const next = value === null ? props.modelValue : decodeTargetValue(value);
    emit("update:modelValue", next);
    emit("close");
}
</script>

<style scoped>
.target-picker {
    width: 16rem;
    border: none;
}
</style>
