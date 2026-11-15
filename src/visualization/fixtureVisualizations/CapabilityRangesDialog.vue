<template>
    <Dialog v-model:visible="visible" modal :header="`${title} – ranges`" :style="{ width: 'min(48rem, 90vw)' }">
        <table class="ranges">
            <thead>
                <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Kind</th>
                    <th>Values</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(segment, i) in segments" :key="i">
                    <td class="dmx">
                        <InputNumber :model-value="segment.from" :min="0" :max="255" size="small" fluid aria-label="From (0–255)" @update:model-value="setField(i, 'from', $event)" />
                    </td>
                    <td class="dmx">
                        <InputNumber :model-value="segment.to" :min="0" :max="255" size="small" fluid aria-label="To (0–255)" @update:model-value="setField(i, 'to', $event)" />
                    </td>
                    <td class="kind">
                        <Select :model-value="segment.kind" :options="SEGMENT_KINDS" size="small" fluid aria-label="Kind" @update:model-value="setKind(i, $event)" />
                    </td>
                    <td>
                        <div class="values">
                            <InputNumber
                                v-for="field in NUMERIC_FIELDS[segment.kind]"
                                :key="field"
                                v-tooltip.top="field"
                                :model-value="numberField(segment, field)"
                                :max-fraction-digits="3"
                                size="small"
                                class="number"
                                :placeholder="field"
                                :aria-label="field"
                                @update:model-value="setField(i, field, $event)"
                            />
                            <Select
                                v-if="segment.kind === 'shutter'"
                                :model-value="segment.effect"
                                :options="SHUTTER_EFFECTS"
                                size="small"
                                aria-label="Shutter effect"
                                @update:model-value="setValue(i, 'effect', $event)"
                            />
                            <Select
                                v-if="segment.kind === 'pattern'"
                                :model-value="segment.pattern"
                                :options="LASER_PATTERNS"
                                size="small"
                                aria-label="Laser pattern"
                                @update:model-value="setValue(i, 'pattern', $event)"
                            />
                            <template v-if="segment.kind === 'color'">
                                <InputText
                                    :model-value="segment.colors.join(', ')"
                                    placeholder="#ff0000, #0000ff"
                                    size="small"
                                    class="colors"
                                    aria-label="Colors"
                                    @update:model-value="setColors(i, $event ?? '')"
                                />
                                <InputNumber
                                    :model-value="segment.temperature"
                                    placeholder="K"
                                    suffix=" K"
                                    size="small"
                                    class="number"
                                    aria-label="Color temperature"
                                    @update:model-value="setValue(i, 'temperature', $event)"
                                />
                            </template>
                        </div>
                    </td>
                    <td>
                        <Button icon="pi pi-trash" text rounded severity="secondary" size="small" aria-label="Remove range" @click="removeSegment(i)" />
                    </td>
                </tr>
                <tr v-if="segments.length === 0">
                    <td colspan="5" class="empty">No ranges: the default range applies.</td>
                </tr>
            </tbody>
        </table>
        <template #footer>
            <Button icon="pi pi-plus" label="Add range" text size="small" @click="addSegment" />
            <Button label="Close" size="small" @click="visible = false" />
        </template>
    </Dialog>
</template>

<script setup lang="ts">
/** Range table of one capability (feature 006, research R14); every edit is emitted right away as new segments. */
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Select from "primevue/select";

import type { CapabilitySegment, LaserPattern, ShutterEffect } from "../capabilities/types";

type SegmentKind = CapabilitySegment["kind"];

const SEGMENT_KINDS: SegmentKind[] = ["linear", "shutter", "wheelSlot", "rotation", "angle", "color", "pattern", "none"];
const SHUTTER_EFFECTS: ShutterEffect[] = ["open", "closed", "strobe", "pulse", "rampUp", "rampDown", "rampUpDown", "random"];
const LASER_PATTERNS: LaserPattern[] = ["beam", "fan", "cone", "sheet", "dots"];
/** Numeric value fields per segment kind (besides from/to). */
const NUMERIC_FIELDS: Record<SegmentKind, string[]> = {
    linear: ["start", "end"],
    shutter: ["rateStart", "rateEnd"],
    wheelSlot: ["slotStart", "slotEnd"],
    rotation: ["speedStart", "speedEnd"],
    angle: ["start", "end"],
    color: [],
    pattern: [],
    none: [],
};

const props = defineProps<{
    /** capability label, shown in the header */
    title: string;
    segments: CapabilitySegment[];
    /** kind of a new range */
    defaultKind: SegmentKind;
}>();

const emit = defineEmits<{
    "update:segments": [segments: CapabilitySegment[]];
}>();

const visible = defineModel<boolean>("visible", { required: true });

function numberField(segment: CapabilitySegment, field: string): number | null {
    const value = (segment as unknown as Record<string, unknown>)[field];
    return typeof value === "number" ? value : null;
}

function update(mutate: (segments: CapabilitySegment[]) => void) {
    const copy = JSON.parse(JSON.stringify(props.segments)) as CapabilitySegment[];
    mutate(copy);
    emit("update:segments", copy);
}

function newSegment(kind: SegmentKind, from: number, to: number): CapabilitySegment {
    switch (kind) {
        case "linear":
        case "angle":
            return { kind, from, to, start: 0, end: 1 };
        case "shutter":
            return { kind, from, to, effect: "open", rateStart: 0, rateEnd: 0 };
        case "wheelSlot":
            return { kind, from, to, slotStart: 1, slotEnd: 1 };
        case "rotation":
            return { kind, from, to, speedStart: 0, speedEnd: 0 };
        case "color":
            return { kind, from, to, colors: ["#ffffff"], temperature: null };
        case "pattern":
            return { kind, from, to, pattern: "beam" };
        case "none":
            return { kind, from, to };
    }
}

function addSegment() {
    update((segments) => {
        const last = segments[segments.length - 1];
        const from = last ? Math.min(255, last.to + 1) : 0;
        segments.push(newSegment(props.defaultKind, from, 255));
    });
}

function removeSegment(index: number) {
    update((segments) => segments.splice(index, 1));
}

function setKind(index: number, kind: SegmentKind) {
    update((segments) => {
        const old = segments[index];
        segments[index] = newSegment(kind, old.from, old.to);
    });
}

function setValue(index: number, field: string, value: unknown) {
    update((segments) => {
        (segments[index] as unknown as Record<string, unknown>)[field] = value;
    });
}

function setField(index: number, field: string, value: number | null) {
    if (value !== null) {
        setValue(index, field, value);
    }
}

function setColors(index: number, text: string) {
    const colors = text
        .split(",")
        .map((c) => c.trim())
        .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
    setValue(index, "colors", colors);
}
</script>

<style scoped>
.ranges {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
}

.ranges th {
    text-align: left;
    font-weight: normal;
    color: var(--p-text-muted-color);
    padding: 0 0.5rem 0.25rem 0;
}

.ranges td {
    padding: 0.2rem 0.5rem 0.2rem 0;
    vertical-align: middle;
}

.dmx {
    width: 5rem;
}

.kind {
    width: 8rem;
}

.values {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
}

.number {
    width: 6rem;
}

.number :deep(input) {
    width: 100%;
}

.colors {
    width: 12rem;
}

.empty {
    color: var(--p-text-muted-color);
}
</style>
