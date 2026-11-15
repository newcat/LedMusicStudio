<template>
    <div class="capability-mapping">
        <div v-if="channels === null" class="note">Choose a profile and mode in the Fixture section to map channels.</div>
        <template v-else>
            <Message v-if="modeChanged" severity="warn" size="small" :closable="false">Fixture mode changed – mapping may be outdated</Message>
            <ConfirmPopup :group="confirmGroup" />

            <section v-for="group in visibleGroups" :key="group.label" class="capability-group">
                <div class="group-label">{{ group.label }}</div>
                <div v-for="key in group.keys" :key="key" class="capability">
                    <PropertyRow :label="KEY_INFO[key].label" :hint="summaryOf(key) || undefined">
                        <div class="channel-row">
                            <Select
                                :model-value="entryOf(key)?.channel ?? -1"
                                :options="channelOptions"
                                option-label="label"
                                option-value="value"
                                size="small"
                                fluid
                                class="channel-select"
                                :aria-label="`${KEY_INFO[key].label} channel`"
                                @update:model-value="setChannel(key, $event)"
                            />
                            <span
                                v-if="entryOf(key)"
                                v-tooltip.top="entryOf(key)!.source === 'manual' ? 'Edited manually' : 'Auto-assigned'"
                                class="source-dot"
                                :class="entryOf(key)!.source"
                            ></span>
                            <Button
                                v-if="hasDetails(key)"
                                text
                                rounded
                                size="small"
                                severity="secondary"
                                :icon="expanded.has(key) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                                :aria-label="expanded.has(key) ? 'Hide details' : 'Show details'"
                                :aria-expanded="expanded.has(key)"
                                @click="toggle(key)"
                            />
                        </div>
                    </PropertyRow>

                    <div v-if="expanded.has(key)" class="details">
                        <PropertyRow v-if="KEY_INFO[key].hasFine" label="Fine">
                            <Select
                                :model-value="entryOf(key)?.fine ?? -1"
                                :options="fineOptions(key)"
                                option-label="label"
                                option-value="value"
                                size="small"
                                fluid
                                :disabled="!isMapped(key)"
                                :aria-label="`${KEY_INFO[key].label} fine channel`"
                                @update:model-value="setFine(key, $event)"
                            />
                        </PropertyRow>
                        <template v-if="KEY_INFO[key].segmentKind === 'linear'">
                            <PropertyRow v-if="!isMapped(key)" label="Default">
                                <InputNumber
                                    :model-value="entryOf(key)?.defaultValue ?? KEY_INFO[key].defaultValue"
                                    :max-fraction-digits="3"
                                    size="small"
                                    fluid
                                    :suffix="unitSuffix(key)"
                                    :aria-label="`${KEY_INFO[key].label} default`"
                                    @update:model-value="setDefault(key, $event)"
                                />
                            </PropertyRow>
                            <template v-else-if="rangeOf(key)">
                                <PropertyRow label="Range from">
                                    <InputNumber
                                        :model-value="rangeOf(key)![0]"
                                        :max-fraction-digits="3"
                                        size="small"
                                        fluid
                                        :suffix="unitSuffix(key)"
                                        :aria-label="`${KEY_INFO[key].label} range from`"
                                        @update:model-value="setRange(key, 0, $event)"
                                    />
                                </PropertyRow>
                                <PropertyRow label="Range to">
                                    <InputNumber
                                        :model-value="rangeOf(key)![1]"
                                        :max-fraction-digits="3"
                                        size="small"
                                        fluid
                                        :suffix="unitSuffix(key)"
                                        :aria-label="`${KEY_INFO[key].label} range to`"
                                        @update:model-value="setRange(key, 1, $event)"
                                    />
                                </PropertyRow>
                            </template>
                        </template>
                        <PropertyRow v-if="KEY_INFO[key].segmentKind === 'wheelSlot' && wheelNames.length > 0" label="Wheel">
                            <Select
                                :model-value="entryOf(key)?.wheel ?? null"
                                :options="wheelNames"
                                placeholder="No wheel"
                                show-clear
                                size="small"
                                fluid
                                :aria-label="`${KEY_INFO[key].label} wheel`"
                                @update:model-value="setWheel(key, $event)"
                            />
                            <template #hint>
                                <div v-if="wheelOf(key)" class="wheel-preview">
                                    <template v-for="(slot, i) in wheelOf(key)!.slots" :key="i">
                                        <img v-if="goboSrc(slot)" :src="goboSrc(slot)!" :title="slotName(slot, i)" class="gobo-thumb" alt="" />
                                        <span v-else-if="isGenericGobo(slot)" :title="slotName(slot, i)" class="gobo-thumb gobo-generic pi pi-th-large"></span>
                                        <span v-else :title="slotName(slot, i)" class="slot-swatch" :style="swatchStyle(slot)"></span>
                                    </template>
                                </div>
                            </template>
                        </PropertyRow>
                        <div v-if="KEY_INFO[key].segmentKind" class="detail-actions">
                            <Button text size="small" icon="pi pi-table" :label="`Edit ranges… (${segmentCount(key)})`" @click="openRanges(key)" />
                        </div>
                    </div>
                </div>
            </section>

            <div class="list-actions">
                <Button
                    v-if="unmappedKeyCount > 0"
                    text
                    size="small"
                    :icon="showUnmapped ? 'pi pi-eye-slash' : 'pi pi-eye'"
                    :label="showUnmapped ? 'Hide unmapped' : `Show ${unmappedKeyCount} unmapped`"
                    @click="showUnmapped = !showUnmapped"
                />
                <Button v-if="mapping.cells.length > 0" text size="small" icon="pi pi-th-large" :label="`Edit cells… (${mapping.cells.length})`" @click="cellsOpen = true" />
            </div>
            <div v-if="mapping.cells.length > 0 && emitterCount !== undefined && mapping.cells.length !== emitterCount" class="note">
                {{ mapping.cells.length }} pixels are spread over {{ emitterCount }} model cells.
            </div>
            <div v-if="unmapped.length > 0" class="note">Unmapped channels: {{ unmapped.map((c) => `${c.index + 1}: ${c.key}`).join(", ") }}</div>
            <div v-if="note" class="note">{{ note }}</div>

            <CapabilityRangesDialog
                v-if="rangesKey"
                v-model:visible="rangesOpen"
                :title="KEY_INFO[rangesKey].label"
                :segments="entryOf(rangesKey)?.segments ?? []"
                :default-kind="KEY_INFO[rangesKey].segmentKind ?? 'linear'"
                @update:segments="setSegments(rangesKey, $event)"
            />
            <CapabilityCellsDialog
                v-model:visible="cellsOpen"
                :cells="mapping.cells"
                :channel-options="channelOptions"
                :emitter-count="emitterCount"
                @update:cells="setCells"
            />
        </template>
    </div>
</template>

<script setup lang="ts">
/**
 * Capability mapping editor (contracts/rendering-ui.md, FR-011). Emits a new mapping object on every edit; any
 * edit of an entry marks it `source: "manual"`. Auto-Assign regenerates the mapping from the fixture's OFL mode
 * (US2); the mapping is never changed automatically.
 *
 * Compact layout (feature 006, contracts/inspector-ui.md → Channel mapping section): mapped capabilities as property
 * rows with a summary line, unmapped ones behind a filter, range and cell tables in dialogs. Auto-Assign and the
 * mapped count live in the section header; they are exposed (`onAutoAssign`, `mappedCount`, `totalCount`).
 */
import { computed, ref } from "vue";
import Button from "primevue/button";
import ConfirmPopup from "primevue/confirmpopup";
import { useConfirm } from "primevue/useconfirm";
import InputNumber from "primevue/inputnumber";
import Message from "primevue/message";
import Select from "primevue/select";

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
    WheelDefinition,
    WheelSlot,
} from "../capabilities/types";
import { fixtureModelOf } from "./defaultMapping";
import PropertyRow from "@/scene/editor/inspector/PropertyRow.vue";
import CapabilityRangesDialog from "./CapabilityRangesDialog.vue";
import CapabilityCellsDialog from "./CapabilityCellsDialog.vue";
import { capabilitySummary, mappedChannelCount } from "./capabilitySummary";

const props = defineProps<{
    mapping: CapabilityMapping;
    type: VisualizationType;
    controller: FixtureVisualizationController<DmxFixture>;
    /** Model of the visualization object: its limits are the fallback ranges of Auto-Assign. */
    modelId?: string;
    /** Number of `cell-*` emitters of the model; shows the cell-spread hint when it differs from the pixel count. */
    emitterCount?: number;
    /** muted note at the end, e.g. the fallbacks of the type */
    note?: string;
}>();

const emit = defineEmits<{
    "update:mapping": [mapping: CapabilityMapping];
}>();

const UNIT_SUFFIX: Partial<Record<string, string>> = { deg: "°", K: " K", rps: " rps" };

const expanded = ref(new Set<CapabilityKey>());
/** unmapped capabilities are hidden by default (per editor instance) */
const showUnmapped = ref(false);
const rangesKey = ref<CapabilityKey | null>(null);
const rangesOpen = ref(false);
const cellsOpen = ref(false);

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

/** Mapped capabilities first; unmapped ones only with the filter off. Empty groups are hidden. */
const visibleGroups = computed(() =>
    groups.value
        .map((g) => ({ label: g.label, keys: g.keys.filter((k) => showUnmapped.value || isMapped(k)) }))
        .filter((g) => g.keys.length > 0)
);

const unmappedKeyCount = computed(() => groups.value.reduce((n, g) => n + g.keys.filter((k) => !isMapped(k)).length, 0));

/** Header badge: distinct mapped channels / channels of the mode. */
const totalCount = computed(() => props.controller.fixture.channelNames.length);
const mappedCount = computed(() => mappedChannelCount(props.mapping, totalCount.value));

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

function summaryOf(key: CapabilityKey): string {
    return capabilitySummary(entryOf(key), KEY_INFO[key], props.mapping.wheels);
}

/** Whether the row has an expandable detail area. */
function hasDetails(key: CapabilityKey): boolean {
    const info = KEY_INFO[key];
    return info.hasFine || info.segmentKind !== null;
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

function openRanges(key: CapabilityKey) {
    rangesKey.value = key;
    rangesOpen.value = true;
}

function setSegments(key: CapabilityKey, segments: CapabilitySegment[]) {
    updateEntry(key, (entry) => (entry.segments = segments));
}

function setCells(cells: CellMapping[]) {
    update((mapping) => (mapping.cells = cells));
}

defineExpose({ onAutoAssign, mappedCount, totalCount });
</script>

<style scoped>
.capability-mapping {
    display: flex;
    flex-direction: column;
    gap: var(--insp-gap-2, 8px);
    min-width: 0;
}

.capability-group {
    display: flex;
    flex-direction: column;
    gap: var(--insp-gap-2, 8px);
}

.group-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-text-muted-color);
    margin-top: var(--insp-gap-1, 4px);
}

.channel-row {
    display: flex;
    align-items: center;
    gap: var(--insp-gap-1, 4px);
    min-width: 0;
}

.channel-select {
    flex: 1;
    min-width: 0;
}

.source-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--p-text-muted-color);
}

.source-dot.manual {
    background: var(--p-primary-color);
}

.details {
    display: flex;
    flex-direction: column;
    gap: var(--insp-gap-2, 8px);
    margin: var(--insp-gap-1, 4px) 0 var(--insp-gap-1, 4px) var(--insp-gap-2, 8px);
    padding-left: var(--insp-gap-2, 8px);
    border-left: 2px solid var(--p-content-border-color);
}

.detail-actions,
.list-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--insp-gap-1, 4px);
}

.note {
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
}

.wheel-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
    margin-top: 2px;
}

.slot-swatch {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    border: 1px solid var(--p-content-border-color);
}

.gobo-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #000;
}

.gobo-generic {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 12px;
}
</style>
