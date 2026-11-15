<template>
    <Select
        :model-value="selected"
        :options="optionGroups"
        option-label="label"
        option-value="value"
        option-group-label="label"
        option-group-children="items"
        :placeholder="mixed ? 'Mixed' : placeholder"
        :invalid="missing"
        class="w-full"
        size="small"
        @update:model-value="onSelect"
    />
</template>

<script lang="ts">
import { FixtureType, useStage } from "@/stage";
import { decodeTarget, encodeTarget } from "../targets";
import type { Target } from "../types";

/** "clip" is only offered with `allowClip` (Attribute Output nodes), "inherit" with `allowInherit` (clips). */
export type TargetSelectValue = Target | null | "clip" | "inherit";

export const TARGET_NONE = "__none__";

export interface TargetOption {
    label: string;
    value: string;
}
export interface TargetOptionGroup {
    label: string;
    items: TargetOption[];
}

/** Grouped options: General (clip/inherit/none), Groups, Fixtures. Values: "clip", "inherit", TARGET_NONE, encoded targets. */
export function buildTargetOptions(opts: { allowClip?: boolean; allowNone?: boolean; allowInherit?: boolean; fixturesOnly?: boolean }): TargetOptionGroup[] {
    const stage = useStage();
    const groups: TargetOptionGroup[] = [];
    const general: TargetOption[] = [];
    if (opts.allowClip) {
        general.push({ label: "Clip target", value: "clip" });
    }
    if (opts.allowInherit) {
        general.push({ label: "Inherit (track target)", value: "inherit" });
    }
    if (opts.allowNone ?? true) {
        general.push({ label: "None", value: TARGET_NONE });
    }
    if (general.length > 0) {
        groups.push({ label: "General", items: general });
    }
    if (!opts.fixturesOnly && stage.groups.length > 0) {
        groups.push({ label: "Groups", items: stage.groups.map((g) => ({ label: g.name, value: encodeTarget({ kind: "group", id: g.id }) })) });
    }
    const fixtures = Array.from(stage.fixtures.values())
        .filter((f) => f.type === FixtureType.DMX)
        .map((f) => ({ label: f.name, value: encodeTarget({ kind: "fixture", id: f.id }) }));
    if (fixtures.length > 0) {
        groups.push({ label: "Fixtures", items: fixtures });
    }
    return groups;
}

export function encodeTargetValue(value: TargetSelectValue, allowNone = true): string | null {
    if (value === "clip" || value === "inherit") {
        return value;
    }
    return value ? encodeTarget(value) : allowNone ? TARGET_NONE : null;
}

export function decodeTargetValue(value: string | null | undefined): TargetSelectValue {
    if (value === "clip" || value === "inherit") {
        return value;
    }
    if (!value || value === TARGET_NONE) {
        return null;
    }
    return decodeTarget(value);
}
</script>

<script setup lang="ts">
import { computed } from "vue";
import Select from "primevue/select";

const props = withDefaults(
    defineProps<{
        modelValue: TargetSelectValue;
        allowClip?: boolean;
        allowNone?: boolean;
        allowInherit?: boolean;
        fixturesOnly?: boolean;
        placeholder?: string;
        /** Several values: shows the placeholder "Mixed" with no selected value. */
        mixed?: boolean;
    }>(),
    { allowClip: false, allowNone: true, allowInherit: false, fixturesOnly: false, placeholder: "No target", mixed: false }
);

const emit = defineEmits<{ "update:modelValue": [value: TargetSelectValue] }>();

const stage = useStage();

const selected = computed(() => (props.mixed ? null : encodeTargetValue(props.modelValue, props.allowNone)));

const optionGroups = computed(() =>
    buildTargetOptions({ allowClip: props.allowClip, allowNone: props.allowNone, allowInherit: props.allowInherit, fixturesOnly: props.fixturesOnly })
);

/** A target whose group or fixture no longer exists. */
const missing = computed(() => {
    const t = props.modelValue;
    if (props.mixed || !t || t === "clip" || t === "inherit") {
        return false;
    }
    return t.kind === "group" ? !stage.groups.some((g) => g.id === t.id) : !stage.fixtures.has(t.id);
});

function onSelect(value: string | null) {
    emit("update:modelValue", decodeTargetValue(value));
}
</script>
