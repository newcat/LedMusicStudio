<template>
    <Select
        :model-value="selected"
        :options="optionGroups"
        option-label="label"
        option-value="value"
        option-group-label="label"
        option-group-children="items"
        :placeholder="placeholder"
        :invalid="missing"
        class="w-full"
        size="small"
        @update:model-value="onSelect"
    />
</template>

<script setup lang="ts">
import { computed } from "vue";
import Select from "primevue/select";
import { FixtureType, useStage } from "@/stage";
import { decodeTarget, encodeTarget } from "../targets";
import type { Target } from "../types";

/** "clip" is only offered with `allowClip` (Attribute Output nodes). */
export type TargetSelectValue = Target | null | "clip";

const props = withDefaults(
    defineProps<{
        modelValue: TargetSelectValue;
        allowClip?: boolean;
        allowNone?: boolean;
        fixturesOnly?: boolean;
        placeholder?: string;
    }>(),
    { allowClip: false, allowNone: true, fixturesOnly: false, placeholder: "No target" }
);

const emit = defineEmits<{ "update:modelValue": [value: TargetSelectValue] }>();

const stage = useStage();

const NONE = "__none__";

const selected = computed(() => (props.modelValue === "clip" ? "clip" : props.modelValue ? encodeTarget(props.modelValue) : props.allowNone ? NONE : null));

const optionGroups = computed(() => {
    const groups: Array<{ label: string; items: Array<{ label: string; value: string }> }> = [];
    const general: Array<{ label: string; value: string }> = [];
    if (props.allowClip) {
        general.push({ label: "Clip target", value: "clip" });
    }
    if (props.allowNone) {
        general.push({ label: "None", value: NONE });
    }
    if (general.length > 0) {
        groups.push({ label: "General", items: general });
    }
    if (!props.fixturesOnly && stage.groups.length > 0) {
        groups.push({ label: "Groups", items: stage.groups.map((g) => ({ label: g.name, value: encodeTarget({ kind: "group", id: g.id }) })) });
    }
    const fixtures = Array.from(stage.fixtures.values())
        .filter((f) => f.type === FixtureType.DMX)
        .map((f) => ({ label: f.name, value: encodeTarget({ kind: "fixture", id: f.id }) }));
    if (fixtures.length > 0) {
        groups.push({ label: "Fixtures", items: fixtures });
    }
    return groups;
});

/** A target whose group or fixture no longer exists. */
const missing = computed(() => {
    const t = props.modelValue;
    if (!t || t === "clip") {
        return false;
    }
    return t.kind === "group" ? !stage.groups.some((g) => g.id === t.id) : !stage.fixtures.has(t.id);
});

function onSelect(value: string | null) {
    if (value === "clip") {
        emit("update:modelValue", "clip");
    } else if (!value || value === NONE) {
        emit("update:modelValue", null);
    } else {
        emit("update:modelValue", decodeTarget(value));
    }
}
</script>
