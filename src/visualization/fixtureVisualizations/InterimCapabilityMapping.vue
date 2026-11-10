<template>
    <Button severity="secondary" outlined @click="autoAssign">Auto-Assign</Button>
    <div class="interim-mapping-grid">
        <template v-for="key in keys" :key="key">
            <div class="font-bold">{{ KEY_INFO[key].label }}</div>
            <LabelledFormField label="Channel">
                <DmxChannelSelector :model-value="mapping.channels[key]?.channel ?? -1" :fixture="fixture" @update:model-value="setChannel(key, $event)" />
            </LabelledFormField>
            <template v-if="rangeOf(key)">
                <LabelledFormField label="Start">
                    <InputNumber :model-value="rangeOf(key)![0]" :max-fraction-digits="3" @update:model-value="setRange(key, 0, $event)" />
                </LabelledFormField>
                <LabelledFormField label="End">
                    <InputNumber :model-value="rangeOf(key)![1]" :max-fraction-digits="3" @update:model-value="setRange(key, 1, $event)" />
                </LabelledFormField>
            </template>
            <template v-else>
                <div></div>
                <div></div>
            </template>
        </template>
    </div>
</template>

<script setup lang="ts">
/**
 * Interim channel mapping for the beam and generic visualizations on the feature 003 mapping shape: one channel and
 * a linear start/end range per key. Replaced by the CapabilityMappingEditor (T027/T028).
 */
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";

import LabelledFormField from "@/components/LabelledFormField.vue";
import { DmxFixture } from "@/stage/fixtures";
import type { Capability } from "@/stage/fixtures/dmx/open-fixture";
import { KEY_INFO } from "../capabilities/keys";
import type { CapabilityChannel, CapabilityKey, CapabilityMapping } from "../capabilities/types";
import DmxChannelSelector from "./DmxChannelSelector.vue";

const mapping = defineModel<CapabilityMapping>("mapping", { required: true });

const props = defineProps<{
    fixture: DmxFixture;
    keys: CapabilityKey[];
}>();

/** OFL capabilities that identify the channel of a key (used by Auto-Assign). */
const AUTO_ASSIGN: Partial<Record<CapabilityKey, (c: Capability) => boolean>> = {
    pan: (c) => c.type === "Pan",
    tilt: (c) => c.type === "Tilt",
    zoom: (c) => c.type === "Zoom" || c.type === "BeamAngle",
    dimmer: (c) => c.type === "Intensity",
    red: (c) => c.type === "ColorIntensity" && c.color === "Red",
    green: (c) => c.type === "ColorIntensity" && c.color === "Green",
    blue: (c) => c.type === "ColorIntensity" && c.color === "Blue",
    white: (c) => c.type === "ColorIntensity" && c.color === "White",
};

function newEntry(key: CapabilityKey): CapabilityChannel {
    const range = KEY_INFO[key].defaultRange;
    return {
        channel: -1,
        fine: -1,
        segments: range ? [{ kind: "linear", from: 0, to: 255, start: range[0], end: range[1] }] : [],
        defaultValue: KEY_INFO[key].defaultValue,
        source: "manual",
    };
}

function entryOf(key: CapabilityKey): CapabilityChannel {
    let entry = mapping.value.channels[key];
    if (!entry) {
        entry = newEntry(key);
        mapping.value.channels[key] = entry;
    }
    return entry;
}

function setChannel(key: CapabilityKey, channel: number) {
    const entry = entryOf(key);
    entry.channel = channel;
    entry.source = "manual";
}

/** Start/end of a single linear segment (or the key's default range); null when the key has other segments. */
function rangeOf(key: CapabilityKey): [number, number] | null {
    const entry = mapping.value.channels[key];
    if (!entry || entry.segments.length === 0) {
        return KEY_INFO[key].defaultRange;
    }
    const segment = entry.segments[0];
    return entry.segments.length === 1 && segment.kind === "linear" ? [segment.start, segment.end] : null;
}

function setRange(key: CapabilityKey, index: 0 | 1, value: number | null) {
    const current = rangeOf(key);
    if (!current || value === null) {
        return;
    }
    const range: [number, number] = [...current];
    range[index] = value;
    const entry = entryOf(key);
    entry.segments = [{ kind: "linear", from: 0, to: 255, start: range[0], end: range[1] }];
    entry.source = "manual";
}

function autoAssign() {
    const channels = props.fixture.channelNames;
    const availableChannels = props.fixture.config.definition?.availableChannels ?? {};
    const find = (predicate: (capability: Capability) => boolean) =>
        channels.findIndex((channel) => {
            const definition = availableChannels[channel];
            return !!definition && ((definition.capability && predicate(definition.capability)) || !!definition.capabilities?.some((c) => predicate(c)));
        });
    for (const key of props.keys) {
        const predicate = AUTO_ASSIGN[key];
        if (!predicate) {
            continue;
        }
        const index = find(predicate);
        if (index >= 0 || mapping.value.channels[key]) {
            setChannel(key, index);
        }
    }
}
</script>

<style scoped>
.interim-mapping-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: min-content;
    gap: 1rem;
    align-items: center;
    margin-top: 1rem;
}
</style>
