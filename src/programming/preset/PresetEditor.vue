<template>
    <div class="preset-editor">
        <div class="flex items-center gap-4 flex-wrap">
            <Tag :value="`${PRESET_KIND_LABELS[state.presetKind]} preset`" />
            <span class="text-sm opacity-70">Used by {{ uses }} look{{ uses === 1 ? "" : "s" }}</span>
        </div>

        <div v-if="state.presetKind === 'position'" class="flex items-center gap-2">
            <span class="w-36">Aim at target</span>
            <Select
                :model-value="state.aimTargetId ?? NONE"
                :options="[{ label: 'None (use values)', value: NONE }, ...aimTargets]"
                option-label="label"
                option-value="value"
                size="small"
                class="min-w-48"
                :invalid="!!state.aimTargetId && !aimTargets.some((t) => t.value === state.aimTargetId)"
                @update:model-value="state.aimTargetId = $event === NONE ? null : $event"
            />
            <span v-if="state.aimTargetId" class="text-xs opacity-70">pan/tilt values below are ignored</span>
        </div>

        <section>
            <div class="flex items-center gap-2 mb-2">
                <h3 class="font-bold">Common values</h3>
                <Button text size="small" icon="pi pi-plus" :disabled="addableCommon.length === 0" @click="commonMenu?.toggle($event)" />
                <Menu ref="commonMenu" :model="commonItems" :popup="true" />
            </div>
            <div v-if="commonKeys.length === 0" class="text-sm opacity-70">No common values.</div>
            <div v-for="key in commonKeys" :key="key" class="row">
                <div>{{ ATTRIBUTES[key].label }}</div>
                <AttributeValueEditor :attribute-key="key" :model-value="state.common[key]!" :profiles="allProfiles" @update:model-value="setCommon(key, $event)" />
                <Button text rounded size="small" icon="pi pi-times" severity="secondary" @click="removeCommon(key)" />
            </div>
        </section>

        <section>
            <div class="flex items-center gap-2 mb-2">
                <h3 class="font-bold">Per-fixture values</h3>
                <div class="w-56"><TargetSelect :model-value="null" fixtures-only :allow-none="false" placeholder="Add fixture…" @update:model-value="addFixture" /></div>
            </div>
            <div v-if="fixtureIds.length === 0" class="text-sm opacity-70">No per-fixture values. Fixtures without one use the common value.</div>
            <div v-for="fixtureId in fixtureIds" :key="fixtureId" class="fixture">
                <div class="flex items-center gap-2">
                    <span class="font-medium">{{ fixtureName(fixtureId) }}</span>
                    <Button text size="small" icon="pi pi-plus" :disabled="addableFor(fixtureId).length === 0" @click="openFixtureMenu(fixtureId, $event)" />
                    <Button text size="small" icon="pi pi-trash" severity="secondary" @click="removeFixture(fixtureId)" />
                </div>
                <div v-for="key in keysOf(fixtureId)" :key="key" class="row">
                    <div>{{ ATTRIBUTES[key].label }}</div>
                    <AttributeValueEditor
                        :attribute-key="key"
                        :model-value="state.perFixture[fixtureId][key]!"
                        :profiles="profilesOf(fixtureId)"
                        @update:model-value="setFixtureValue(fixtureId, key, $event)"
                    />
                    <Button text rounded size="small" icon="pi pi-times" severity="secondary" @click="removeFixtureValue(fixtureId, key)" />
                </div>
            </div>
            <Menu ref="fixtureMenu" :model="fixtureMenuItems" :popup="true" />
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "primevue/button";
import Menu from "primevue/menu";
import Select from "primevue/select";
import Tag from "primevue/tag";
import type { MenuItem } from "primevue/menuitem";
import { useStage } from "@/stage";
import { ATTRIBUTES, omitKey, type AttributeKey, type AttributeValue, type AttributeValues } from "../attributes";
import AttributeValueEditor from "../components/AttributeValueEditor.vue";
import TargetSelect, { type TargetSelectValue } from "../components/TargetSelect.vue";
import { editorProfiles, initialAttributeValue, useAimTargets } from "../editorContext";
import { profileOptions } from "../profile";
import { PRESET_KEYS, PRESET_KIND_LABELS } from "../states";
import { lookUsesOfPreset } from "../uses";
import type { PresetLibraryItem } from "./Preset.libraryItem";

const NONE = "__none__";

const props = defineProps<{ preset: PresetLibraryItem }>();

const stage = useStage();
const state = computed(() => props.preset.state);
const allowed = computed(() => PRESET_KEYS[state.value.presetKind]);
const aimTargets = useAimTargets();
const uses = computed(() => lookUsesOfPreset(props.preset.id).length);
const allProfiles = computed(() => editorProfiles([]));

function setValues(target: AttributeValues, key: AttributeKey, value: AttributeValue) {
    (target as Record<AttributeKey, AttributeValue>)[key] = value;
}

// --- common ------------------------------------------------------------------------------------------------------

const commonKeys = computed(() => allowed.value.filter((k) => state.value.common[k] !== undefined));
const addableCommon = computed(() => allowed.value.filter((k) => state.value.common[k] === undefined));
const commonMenu = ref<InstanceType<typeof Menu>>();
const commonItems = computed<MenuItem[]>(() =>
    addableCommon.value.map((key) => ({ label: ATTRIBUTES[key].label, command: () => setCommon(key, initialAttributeValue(key, [])) }))
);

function setCommon(key: AttributeKey, value: AttributeValue) {
    setValues(state.value.common, key, value);
}

function removeCommon(key: AttributeKey) {
    state.value.common = omitKey(state.value.common, key);
}

// --- per fixture -------------------------------------------------------------------------------------------------

const fixtureIds = computed(() => Object.keys(state.value.perFixture));
const fixtureMenu = ref<InstanceType<typeof Menu>>();
const menuFixture = ref<string | null>(null);
const fixtureMenuItems = computed<MenuItem[]>(() => {
    const id = menuFixture.value;
    return id ? addableFor(id).map((key) => ({ label: ATTRIBUTES[key].label, command: () => setFixtureValue(id, key, initialAttributeValue(key, [id])) })) : [];
});

function fixtureName(id: string): string {
    return stage.fixtures.get(id)?.name ?? "Missing fixture";
}

function profilesOf(id: string) {
    return profileOptions([id]);
}

function keysOf(id: string): AttributeKey[] {
    return allowed.value.filter((k) => state.value.perFixture[id]?.[k] !== undefined);
}

function addableFor(id: string): AttributeKey[] {
    return allowed.value.filter((k) => state.value.perFixture[id]?.[k] === undefined);
}

function addFixture(target: TargetSelectValue) {
    if (target && target !== "clip" && target.kind === "fixture" && !state.value.perFixture[target.id]) {
        state.value.perFixture[target.id] = {};
    }
}

function removeFixture(id: string) {
    state.value.perFixture = omitKey(state.value.perFixture, id);
}

function openFixtureMenu(id: string, event: Event) {
    menuFixture.value = id;
    fixtureMenu.value?.toggle(event);
}

function setFixtureValue(id: string, key: AttributeKey, value: AttributeValue) {
    setValues((state.value.perFixture[id] ??= {}), key, value);
}

function removeFixtureValue(id: string, key: AttributeKey) {
    state.value.perFixture[id] = omitKey(state.value.perFixture[id], key);
}
</script>

<style scoped>
.preset-editor {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1rem;
    width: 100%;
    overflow: auto;
}
.row {
    display: grid;
    grid-template-columns: 9rem 1fr min-content;
    gap: 0.75rem;
    align-items: center;
    margin-bottom: 0.5rem;
}
.fixture {
    border-left: 2px solid var(--p-content-border-color);
    padding-left: 0.75rem;
    margin-bottom: 0.75rem;
}
</style>
