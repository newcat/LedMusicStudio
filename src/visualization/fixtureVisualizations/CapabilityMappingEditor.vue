<template>
    <div class="capability-mapping">
        <div v-if="channels === null" class="text-sm opacity-70">Select a fixture and mode in the fixture settings to map channels.</div>
        <template v-else>
            <div class="capability-header">
                <Button icon="pi pi-sparkles" label="Auto-Assign" size="small" outlined @click="onAutoAssign($event)" />
                <Message v-if="modeChanged" severity="warn" size="small" :closable="false">⚠ Fixture mode changed – mapping may be outdated</Message>
            </div>
            <ConfirmPopup :group="confirmGroup" />

            <section v-for="group in groups" :key="group.label" class="capability-group">
                <div class="capability-group-label">{{ group.label }}</div>
                <div v-for="key in group.keys" :key="key" class="capability-key">
                    <div class="capability-row">
                        <div class="capability-label">{{ KEY_INFO[key].label }}</div>
                        <Select
                            :model-value="entryOf(key)?.channel ?? -1"
                            :options="channelOptions"
                            option-label="label"
                            option-value="value"
                            size="small"
                            class="capability-channel"
                            @update:model-value="setChannel(key, $event)"
                        />
                        <template v-if="KEY_INFO[key].hasFine">
                            <span class="text-sm opacity-70">fine</span>
                            <Select
                                :model-value="entryOf(key)?.fine ?? -1"
                                :options="fineOptions(key)"
                                option-label="label"
                                option-value="value"
                                size="small"
                                class="capability-channel"
                                :disabled="!isMapped(key)"
                                @update:model-value="setFine(key, $event)"
                            />
                        </template>

                        <template v-if="KEY_INFO[key].segmentKind === 'linear'">
                            <template v-if="!isMapped(key)">
                                <span class="text-sm opacity-70">Default</span>
                                <InputNumber
                                    :model-value="entryOf(key)?.defaultValue ?? KEY_INFO[key].defaultValue"
                                    :max-fraction-digits="3"
                                    size="small"
                                    input-class="capability-number"
                                    :suffix="unitSuffix(key)"
                                    @update:model-value="setDefault(key, $event)"
                                />
                            </template>
                            <template v-else-if="rangeOf(key)">
                                <InputNumber
                                    :model-value="rangeOf(key)![0]"
                                    :max-fraction-digits="3"
                                    size="small"
                                    input-class="capability-number"
                                    :suffix="unitSuffix(key)"
                                    @update:model-value="setRange(key, 0, $event)"
                                />
                                <span>…</span>
                                <InputNumber
                                    :model-value="rangeOf(key)![1]"
                                    :max-fraction-digits="3"
                                    size="small"
                                    input-class="capability-number"
                                    :suffix="unitSuffix(key)"
                                    @update:model-value="setRange(key, 1, $event)"
                                />
                            </template>
                        </template>

                        <template v-if="KEY_INFO[key].segmentKind === 'wheelSlot' && wheelNames.length > 0">
                            <Select
                                :model-value="entryOf(key)?.wheel ?? null"
                                :options="wheelNames"
                                placeholder="Wheel"
                                show-clear
                                size="small"
                                class="capability-channel"
                                @update:model-value="setWheel(key, $event)"
                            />
                        </template>
                        <div v-if="wheelOf(key)" class="wheel-preview">
                            <template v-for="(slot, i) in wheelOf(key)!.slots" :key="i">
                                <img v-if="goboSrc(slot)" :src="goboSrc(slot)!" :title="slotName(slot, i)" class="gobo-thumb" alt="" />
                                <span v-else-if="isGenericGobo(slot)" :title="slotName(slot, i)" class="gobo-thumb gobo-generic pi pi-th-large"></span>
                                <span v-else :title="slotName(slot, i)" class="slot-swatch" :style="swatchStyle(slot)"></span>
                            </template>
                        </div>

                        <Button
                            v-if="KEY_INFO[key].segmentKind"
                            :label="`${segmentCount(key)} ranges ${expanded.has(key) ? '▾' : '▸'}`"
                            text
                            size="small"
                            @click="toggle(key)"
                        />
                        <Tag v-if="entryOf(key)" :value="entryOf(key)!.source" :severity="entryOf(key)!.source === 'manual' ? 'info' : 'secondary'" class="ml-auto" />
                    </div>

                    <table v-if="expanded.has(key)" class="segment-table">
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
                            <tr v-for="(segment, i) in entryOf(key)?.segments ?? []" :key="i">
                                <td>
                                    <InputNumber :model-value="segment.from" :min="0" :max="255" size="small" input-class="capability-dmx" @update:model-value="setSegmentField(key, i, 'from', $event)" />
                                </td>
                                <td>
                                    <InputNumber :model-value="segment.to" :min="0" :max="255" size="small" input-class="capability-dmx" @update:model-value="setSegmentField(key, i, 'to', $event)" />
                                </td>
                                <td>
                                    <Select :model-value="segment.kind" :options="SEGMENT_KINDS" size="small" @update:model-value="setSegmentKind(key, i, $event)" />
                                </td>
                                <td>
                                    <div class="flex gap-1 items-center">
                                        <template v-for="field in NUMERIC_FIELDS[segment.kind]" :key="field">
                                            <InputNumber
                                                v-tooltip.top="field"
                                                :model-value="numberField(segment, field)"
                                                :max-fraction-digits="3"
                                                size="small"
                                                input-class="capability-number"
                                                :placeholder="field"
                                                @update:model-value="setSegmentField(key, i, field, $event)"
                                            />
                                        </template>
                                        <Select
                                            v-if="segment.kind === 'shutter'"
                                            :model-value="segment.effect"
                                            :options="SHUTTER_EFFECTS"
                                            size="small"
                                            @update:model-value="setSegmentValue(key, i, 'effect', $event)"
                                        />
                                        <Select
                                            v-if="segment.kind === 'pattern'"
                                            :model-value="segment.pattern"
                                            :options="LASER_PATTERNS"
                                            size="small"
                                            @update:model-value="setSegmentValue(key, i, 'pattern', $event)"
                                        />
                                        <template v-if="segment.kind === 'color'">
                                            <InputText
                                                :model-value="segment.colors.join(', ')"
                                                placeholder="#ff0000, #0000ff"
                                                size="small"
                                                @update:model-value="setColors(key, i, $event ?? '')"
                                            />
                                            <InputNumber
                                                :model-value="segment.temperature"
                                                placeholder="K"
                                                suffix=" K"
                                                size="small"
                                                input-class="capability-number"
                                                @update:model-value="setSegmentValue(key, i, 'temperature', $event)"
                                            />
                                        </template>
                                    </div>
                                </td>
                                <td>
                                    <Button icon="pi pi-trash" text severity="danger" size="small" aria-label="Remove range" @click="removeSegment(key, i)" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <Button v-if="expanded.has(key)" icon="pi pi-plus" label="Add range" text size="small" @click="addSegment(key)" />
                </div>
            </section>

            <section v-if="mapping.cells.length > 0" class="capability-group">
                <Button :label="`Cells (${mapping.cells.length}) ${cellsExpanded ? '▾' : '▸'}`" text size="small" @click="cellsExpanded = !cellsExpanded" />
                <table v-if="cellsExpanded" class="segment-table">
                    <thead>
                        <tr>
                            <th>Emitter</th>
                            <th>Pixel</th>
                            <th v-for="field in CELL_FIELDS" :key="field.key">{{ field.label }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(cell, i) in mapping.cells" :key="i">
                            <td>{{ cell.emitter }}</td>
                            <td>{{ cell.pixelKey }}</td>
                            <td v-for="field in CELL_FIELDS" :key="field.key">
                                <Select
                                    :model-value="cell[field.key]"
                                    :options="channelOptions"
                                    option-label="label"
                                    option-value="value"
                                    size="small"
                                    class="capability-cell-channel"
                                    @update:model-value="setCellChannel(i, field.key, $event)"
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div v-if="emitterCount !== undefined && mapping.cells.length !== emitterCount" class="text-sm opacity-70">
                    {{ mapping.cells.length }} pixels are spread over {{ emitterCount }} model cells.
                </div>
            </section>

            <div v-if="unmapped.length > 0" class="text-sm opacity-70">
                Unmapped channels: {{ unmapped.map((c) => `${c.index + 1}: ${c.key}`).join(", ") }}
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
/**
 * Capability mapping editor (contracts/rendering-ui.md, FR-011). Emits a new mapping object on every edit; any
 * edit of an entry marks it `source: "manual"`. Auto-Assign regenerates the mapping from the fixture's OFL mode
 * (US2); the mapping is never changed automatically.
 */
import { computed, ref } from "vue";
import Button from "primevue/button";
import ConfirmPopup from "primevue/confirmpopup";
import { useConfirm } from "primevue/useconfirm";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Select from "primevue/select";
import Tag from "primevue/tag";

import { emitSceneToast } from "@/scene/toastBus";
import type { DmxFixture } from "@/stage/fixtures";
import type { VisualizationType } from "@/visualization/fixtureVisualization";
import type { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import { autoMapCapabilities } from "../capabilities/autoMap";
import { kelvinToRgb } from "../capabilities/colorMath";
import { unmappedChannels } from "../capabilities/decode";
import { KEY_GROUPS, KEY_INFO, KEYS_BY_TYPE } from "../capabilities/keys";
import { resolveModeChannels, type OflResolvedChannel } from "../capabilities/oflResolve";
import type {
    CapabilityChannel,
    CapabilityKey,
    CapabilityMapping,
    CapabilitySegment,
    CellMapping,
    LaserPattern,
    ShutterEffect,
    WheelDefinition,
    WheelSlot,
} from "../capabilities/types";
import { fixtureModelOf } from "./defaultMapping";

const props = defineProps<{
    mapping: CapabilityMapping;
    type: VisualizationType;
    controller: FixtureVisualizationController<DmxFixture>;
    /** Model of the visualization object: its limits are the fallback ranges of Auto-Assign. */
    modelId?: string;
    /** Number of `cell-*` emitters of the model; shows the cell-spread hint when it differs from the pixel count. */
    emitterCount?: number;
}>();

const emit = defineEmits<{
    "update:mapping": [mapping: CapabilityMapping];
}>();

type SegmentKind = CapabilitySegment["kind"];
type CellChannelField = Exclude<keyof CellMapping, "emitter" | "pixelKey">;

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
const CELL_FIELDS: Array<{ key: CellChannelField; label: string }> = [
    { key: "red", label: "R" },
    { key: "green", label: "G" },
    { key: "blue", label: "B" },
    { key: "white", label: "W" },
    { key: "amber", label: "A" },
    { key: "uv", label: "UV" },
    { key: "dimmer", label: "Dimmer" },
];
const UNIT_SUFFIX: Partial<Record<string, string>> = { deg: "°", K: " K", rps: " rps" };

const expanded = ref(new Set<CapabilityKey>());
const cellsExpanded = ref(false);

// ------------------------------------------------------------------------------------------------------------
// Fixture channels
// ------------------------------------------------------------------------------------------------------------

const fixtureConfig = computed(() => props.controller.fixture.config);

/** Channels of the fixture's current mode; null without definition or mode. */
const channels = computed<OflResolvedChannel[] | null>(() => {
    const { definition, mode } = fixtureConfig.value;
    return definition && mode ? resolveModeChannels(definition, mode) : null;
});

const channelOptions = computed(() => [
    { label: "— not mapped —", value: -1 },
    ...(channels.value ?? []).map((c) => ({ label: `${c.index + 1}: ${c.key}`, value: c.index })),
]);

/** Outdated notice: the fixture's mode or channel count differs from what the mapping was generated for. */
const modeChanged = computed(() => {
    const { mappedMode, mappedChannelCount } = props.mapping;
    if (mappedMode === null) {
        return false;
    }
    return fixtureConfig.value.mode?.name !== mappedMode || props.controller.fixture.channelNames.length !== mappedChannelCount;
});

const groups = computed(() => {
    const supported = new Set(KEYS_BY_TYPE[props.type]);
    return KEY_GROUPS.map((g) => ({ label: g.label, keys: g.keys.filter((k) => supported.has(k)) })).filter((g) => g.keys.length > 0);
});

const wheelNames = computed(() => Object.keys(props.mapping.wheels));

const unmapped = computed(() => (channels.value ? unmappedChannels(props.mapping, channels.value) : []));

function fineOptions(key: CapabilityKey) {
    const coarse = entryOf(key)?.channel ?? -1;
    return [{ label: "— none —", value: -1 }, ...channelOptions.value.filter((o) => o.value > coarse && coarse >= 0)];
}

// ------------------------------------------------------------------------------------------------------------
// Reading
// ------------------------------------------------------------------------------------------------------------

function entryOf(key: CapabilityKey): CapabilityChannel | undefined {
    return props.mapping.channels[key];
}

function isMapped(key: CapabilityKey): boolean {
    return (entryOf(key)?.channel ?? -1) >= 0;
}

function unitSuffix(key: CapabilityKey): string {
    return UNIT_SUFFIX[KEY_INFO[key].unit] ?? "";
}

function segmentCount(key: CapabilityKey): number {
    return entryOf(key)?.segments.length ?? 0;
}

/** Start/end of a single full-range linear segment (or the implicit default range); null for other segment lists. */
function rangeOf(key: CapabilityKey): [number, number] | null {
    const segments = entryOf(key)?.segments ?? [];
    if (segments.length === 0) {
        return KEY_INFO[key].defaultRange ?? [0, 1];
    }
    const segment = segments[0];
    return segments.length === 1 && segment.kind === "linear" ? [segment.start, segment.end] : null;
}

function wheelOf(key: CapabilityKey): WheelDefinition | null {
    const name = entryOf(key)?.wheel;
    return name ? (props.mapping.wheels[name] ?? null) : null;
}

function numberField(segment: CapabilitySegment, field: string): number | null {
    const value = (segment as unknown as Record<string, unknown>)[field];
    return typeof value === "number" ? value : null;
}

// ------------------------------------------------------------------------------------------------------------
// Wheel preview
// ------------------------------------------------------------------------------------------------------------

function slotName(slot: WheelSlot, index: number): string {
    return `${index + 1}: ${"name" in slot ? slot.name : slot.type}`;
}

function goboSrc(slot: WheelSlot): string | null {
    if (slot.type !== "gobo" || slot.image.startsWith("generic:")) {
        return null;
    }
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(slot.image)}`;
}

function isGenericGobo(slot: WheelSlot): boolean {
    return slot.type === "gobo" && slot.image.startsWith("generic:");
}

function swatchStyle(slot: WheelSlot): Record<string, string> {
    switch (slot.type) {
        case "open":
            return { background: "transparent" };
        case "closed":
            return { background: "#000" };
        case "color": {
            const colors = slot.colors.length > 0 ? slot.colors : slot.temperature !== null ? [kelvinToRgb(slot.temperature).getStyle()] : ["#fff"];
            return colors.length >= 2
                ? { background: `linear-gradient(90deg, ${colors[0]} 50%, ${colors[1]} 50%)` }
                : { background: colors[0] };
        }
        default:
            return { background: "repeating-linear-gradient(45deg, #888 0 2px, transparent 2px 4px)" };
    }
}

// ------------------------------------------------------------------------------------------------------------
// Auto-Assign
// ------------------------------------------------------------------------------------------------------------

const confirm = useConfirm();
/** Own ConfirmPopup group, so another mounted editor does not answer this editor's confirmation. */
const confirmGroup = `capability-mapping-${Math.random().toString(36).slice(2, 10)}`;

const manualCount = computed(() => Object.values(props.mapping.channels).filter((entry) => entry?.source === "manual").length);

/** Regenerates the mapping from the fixture's mode, as one config change (one undo step). */
function autoAssign() {
    const { definition, mode } = fixtureConfig.value;
    if (!definition || !mode) {
        return;
    }
    const mapping = autoMapCapabilities(definition, mode, props.type, fixtureModelOf(props.modelId));
    const mapped = Object.values(mapping.channels).some((entry) => entry && entry.channel >= 0) || mapping.cells.length > 0;
    if (!mapped) {
        emitSceneToast({ severity: "warn", summary: "Auto-Assign", detail: "No supported capabilities found in this fixture mode.", life: 4000 });
    }
    emit("update:mapping", mapping);
}

function onAutoAssign(event: MouseEvent) {
    const count = manualCount.value;
    if (count === 0) {
        autoAssign();
        return;
    }
    confirm.require({
        group: confirmGroup,
        target: event.currentTarget as HTMLElement,
        message: `Replace ${count} manual mapping${count === 1 ? "" : "s"}?`,
        icon: "pi pi-exclamation-triangle",
        rejectProps: { label: "Cancel", severity: "secondary", outlined: true, size: "small" },
        acceptProps: { label: "Replace", size: "small" },
        accept: autoAssign,
    });
}

// ------------------------------------------------------------------------------------------------------------
// Editing (always on a copy, emitted as a new mapping)
// ------------------------------------------------------------------------------------------------------------

function update(mutate: (mapping: CapabilityMapping) => void) {
    const copy = JSON.parse(JSON.stringify(props.mapping)) as CapabilityMapping;
    mutate(copy);
    emit("update:mapping", copy);
}

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

/** Edits the entry of `key` (created if missing) and marks it manual. */
function updateEntry(key: CapabilityKey, mutate: (entry: CapabilityChannel) => void) {
    update((mapping) => {
        const entry = mapping.channels[key] ?? newEntry(key);
        mutate(entry);
        entry.source = "manual";
        mapping.channels[key] = entry;
    });
}

function setChannel(key: CapabilityKey, channel: number) {
    updateEntry(key, (entry) => {
        entry.channel = channel;
        if (channel < 0 || entry.fine <= channel) {
            entry.fine = -1;
        }
    });
}

function setFine(key: CapabilityKey, fine: number) {
    updateEntry(key, (entry) => (entry.fine = fine));
}

function setDefault(key: CapabilityKey, value: number | null) {
    if (value !== null) {
        updateEntry(key, (entry) => (entry.defaultValue = value));
    }
}

function setRange(key: CapabilityKey, index: 0 | 1, value: number | null) {
    const current = rangeOf(key);
    if (!current || value === null) {
        return;
    }
    const range: [number, number] = [current[0], current[1]];
    range[index] = value;
    updateEntry(key, (entry) => (entry.segments = [{ kind: "linear", from: 0, to: 255, start: range[0], end: range[1] }]));
}

function setWheel(key: CapabilityKey, wheel: string | null) {
    updateEntry(key, (entry) => {
        if (wheel) {
            entry.wheel = wheel;
        } else {
            delete entry.wheel;
        }
    });
}

function toggle(key: CapabilityKey) {
    const next = new Set(expanded.value);
    if (!next.delete(key)) {
        next.add(key);
    }
    expanded.value = next;
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

function addSegment(key: CapabilityKey) {
    updateEntry(key, (entry) => {
        const last = entry.segments[entry.segments.length - 1];
        const from = last ? Math.min(255, last.to + 1) : 0;
        entry.segments.push(newSegment(KEY_INFO[key].segmentKind ?? "linear", from, 255));
    });
}

function removeSegment(key: CapabilityKey, index: number) {
    updateEntry(key, (entry) => entry.segments.splice(index, 1));
}

function setSegmentKind(key: CapabilityKey, index: number, kind: SegmentKind) {
    updateEntry(key, (entry) => {
        const old = entry.segments[index];
        entry.segments[index] = newSegment(kind, old.from, old.to);
    });
}

function setSegmentValue(key: CapabilityKey, index: number, field: string, value: unknown) {
    updateEntry(key, (entry) => {
        (entry.segments[index] as unknown as Record<string, unknown>)[field] = value;
    });
}

function setSegmentField(key: CapabilityKey, index: number, field: string, value: number | null) {
    if (value !== null) {
        setSegmentValue(key, index, field, value);
    }
}

function setColors(key: CapabilityKey, index: number, text: string) {
    const colors = text
        .split(",")
        .map((c) => c.trim())
        .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
    setSegmentValue(key, index, "colors", colors);
}

function setCellChannel(index: number, field: CellChannelField, channel: number) {
    update((mapping) => (mapping.cells[index][field] = channel));
}
</script>

<style scoped>
.capability-mapping {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.capability-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
}

.capability-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.capability-group-label {
    font-weight: bold;
}

.capability-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
}

.capability-label {
    width: 9rem;
}

.capability-channel {
    width: 11rem;
}

.capability-cell-channel {
    width: 8rem;
}

.capability-row :deep(.capability-number),
.segment-table :deep(.capability-number) {
    width: 5.5rem;
}

.segment-table :deep(.capability-dmx) {
    width: 4rem;
}

.segment-table {
    margin-left: 9.5rem;
    font-size: 0.875rem;
}

.segment-table th {
    text-align: left;
    font-weight: normal;
    opacity: 0.7;
    padding-right: 0.5rem;
}

.wheel-preview {
    display: flex;
    gap: 0.25rem;
    align-items: center;
}

.slot-swatch {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    border: 1px solid var(--p-content-border-color);
}

.gobo-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #000;
}

.gobo-generic {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 14px;
}
</style>
