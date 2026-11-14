<template>
    <div class="look-editor">
        <div class="flex items-center gap-4 flex-wrap">
            <Button outlined size="small" icon="pi pi-plus" label="Add attribute" :disabled="addable.length === 0" @click="addMenu?.toggle($event)" />
            <Menu ref="addMenu" :model="addItems" :popup="true" />
            <div class="flex items-center gap-2">
                <span class="text-sm">Fan timing</span>
                <Slider v-model="fanTiming" :min="0" :max="100" class="w-40" />
                <span class="text-sm w-12">{{ fanTiming }} %</span>
            </div>
            <span class="text-sm opacity-70">
                <template v-if="fixtures.length > 0">Slot names for the {{ fixtures.length }} fixture(s) of the selected clip's target</template>
                <template v-else>Slot names of all DMX fixtures (place the look on the timeline and give it a target)</template>
            </span>
        </div>

        <div v-if="rows.length === 0" class="opacity-70">No attributes yet. A look sets only the attributes you add.</div>

        <div v-for="key in rows" :key="key" class="row">
            <div class="label">{{ ATTRIBUTES[key].label }}</div>
            <Select :model-value="state.values[key]!.kind" :options="kindOptions(key)" option-label="label" option-value="value" option-disabled="disabled" size="small" class="w-28" @update:model-value="setKind(key, $event)" />
            <div class="value">
                <template v-if="state.values[key]!.kind === 'single'">
                    <AttributeValueEditor :attribute-key="key" :model-value="single(key)" :profiles="profiles" @update:model-value="setValue(key, { kind: 'single', value: $event })" />
                </template>
                <template v-else-if="state.values[key]!.kind === 'fan'">
                    <span class="text-xs opacity-70">from</span>
                    <AttributeValueEditor :attribute-key="key" :model-value="fan(key).from" :profiles="profiles" @update:model-value="setValue(key, { ...fan(key), from: $event })" />
                    <span class="text-xs opacity-70">to</span>
                    <AttributeValueEditor :attribute-key="key" :model-value="fan(key).to" :profiles="profiles" @update:model-value="setValue(key, { ...fan(key), to: $event })" />
                    <label class="flex items-center gap-1 text-sm">
                        <Checkbox :model-value="fan(key).mirror" binary @update:model-value="setValue(key, { ...fan(key), mirror: $event })" /> Mirror
                    </label>
                </template>
                <template v-else-if="state.values[key]!.kind === 'preset'">
                    <Select
                        :model-value="presetId(key)"
                        :options="presetOptions(key)"
                        option-label="label"
                        option-value="value"
                        placeholder="Choose a preset"
                        :invalid="!presetOptions(key).some((p) => p.value === presetId(key))"
                        size="small"
                        class="min-w-48"
                        @update:model-value="setValue(key, { kind: 'preset', presetId: $event })"
                    />
                </template>
                <template v-else-if="state.values[key]!.kind === 'aim'">
                    <Select
                        :model-value="aimTargetId(key)"
                        :options="aimTargets"
                        option-label="label"
                        option-value="value"
                        placeholder="Choose an aim target"
                        :invalid="!aimTargets.some((t) => t.value === aimTargetId(key))"
                        size="small"
                        class="min-w-48"
                        @update:model-value="setValue(key, { kind: 'aim', aimTargetId: $event })"
                    />
                    <span class="text-xs opacity-70">sets pan and tilt</span>
                </template>
            </div>
            <Button text rounded size="small" icon="pi pi-times" severity="secondary" @click="remove(key)" />
        </div>

        <div v-if="bakedCount > 0" class="text-sm opacity-80 flex items-center gap-2">
            <i class="mdi mdi-information-outline"></i>
            {{ bakedCount }} fixture(s) keep per-fixture values from a deleted preset.
            <Button text size="small" label="Clear" @click="state.perFixture = {}" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Menu from "primevue/menu";
import Select from "primevue/select";
import Slider from "primevue/slider";
import type { MenuItem } from "primevue/menuitem";
import { useLibrary } from "@/library/libraryModel";
import { ATTRIBUTE_KEYS, ATTRIBUTES, omitKey, type AttributeKey, type AttributeValue } from "../attributes";
import AttributeValueEditor from "../components/AttributeValueEditor.vue";
import { editorProfiles, initialAttributeValue, useAimTargets, useItemTargetFixtures } from "../editorContext";
import { isPresetLibraryItem } from "../guards";
import { canFan, presetKindOf, type LookValue } from "../states";
import type { LookLibraryItem } from "./Look.libraryItem";

const props = defineProps<{ look: LookLibraryItem }>();

const library = useLibrary();
const state = computed(() => props.look.state);
const fixtures = useItemTargetFixtures(() => props.look);
const fixtureIds = computed(() => fixtures.value.map((f) => f.fixtureId));
const profiles = computed(() => editorProfiles(fixtureIds.value));
const aimTargets = useAimTargets();

const aimsPanTilt = computed(() => state.value.values.pan?.kind === "aim");
/** Attributes in UI order; tilt is hidden while pan aims at a target. */
const rows = computed(() => ATTRIBUTE_KEYS.filter((k) => state.value.values[k] && !(k === "tilt" && aimsPanTilt.value)));
const addable = computed(() => ATTRIBUTE_KEYS.filter((k) => !state.value.values[k] && !(k === "tilt" && aimsPanTilt.value)));

const addMenu = ref<InstanceType<typeof Menu>>();
const addItems = computed<MenuItem[]>(() => addable.value.map((key) => ({ label: ATTRIBUTES[key].label, command: () => add(key) })));

const fanTiming = computed({
    get: () => Math.round(state.value.fanTiming * 100),
    set: (v: number | number[]) => (state.value.fanTiming = Math.min(1, Math.max(0, (Array.isArray(v) ? v[0] : v) / 100))),
});

const bakedCount = computed(() => Object.keys(state.value.perFixture).length);

function add(key: AttributeKey) {
    state.value.values[key] = { kind: "single", value: initialAttributeValue(key, fixtureIds.value) };
}

function remove(key: AttributeKey) {
    state.value.values = omitKey(state.value.values, key);
}

function setValue(key: AttributeKey, value: LookValue) {
    state.value.values[key] = value;
    if (key === "pan" && value.kind === "aim") {
        // an aim value sets tilt too (data-model §6)
        delete state.value.values.tilt;
    }
}

function kindOptions(key: AttributeKey) {
    return [
        { label: "Single", value: "single", disabled: false },
        { label: "Fan", value: "fan", disabled: !canFan(key) },
        { label: "Preset", value: "preset", disabled: presetKindOf(key) === null },
        { label: "Aim", value: "aim", disabled: key !== "pan" },
    ].filter((o) => !o.disabled || o.value === state.value.values[key]?.kind);
}

function setKind(key: AttributeKey, kind: LookValue["kind"]) {
    const current = state.value.values[key];
    const base: AttributeValue =
        current?.kind === "single" ? current.value : current?.kind === "fan" ? current.from : initialAttributeValue(key, fixtureIds.value);
    switch (kind) {
        case "single":
            setValue(key, { kind: "single", value: base });
            break;
        case "fan":
            setValue(key, { kind: "fan", from: base, to: base, mirror: false });
            break;
        case "preset":
            setValue(key, { kind: "preset", presetId: presetOptions(key)[0]?.value ?? "" });
            break;
        case "aim":
            setValue(key, { kind: "aim", aimTargetId: aimTargets.value[0]?.value ?? "" });
            break;
    }
}

function single(key: AttributeKey): AttributeValue {
    const v = state.value.values[key];
    return v?.kind === "single" ? v.value : initialAttributeValue(key, fixtureIds.value);
}

function fan(key: AttributeKey): Extract<LookValue, { kind: "fan" }> {
    return state.value.values[key] as Extract<LookValue, { kind: "fan" }>;
}

function presetId(key: AttributeKey): string {
    const v = state.value.values[key];
    return v?.kind === "preset" ? v.presetId : "";
}

function aimTargetId(key: AttributeKey): string {
    const v = state.value.values[key];
    return v?.kind === "aim" ? v.aimTargetId : "";
}

function presetOptions(key: AttributeKey) {
    const kind = presetKindOf(key);
    return library.items.filter(isPresetLibraryItem).filter((p) => p.state.presetKind === kind).map((p) => ({ label: p.name, value: p.id }));
}
</script>

<style scoped>
.look-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    width: 100%;
    overflow: auto;
}
.row {
    display: grid;
    grid-template-columns: 9rem 7.5rem 1fr min-content;
    gap: 0.75rem;
    align-items: center;
}
.value {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}
</style>
