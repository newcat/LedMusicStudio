<template>
    <InspectorSection ref="section" name="fixture" title="Fixture">
        <template v-if="dmx">
            <PropertyRow label="Profile">
                <div class="profile-row">
                    <Button
                        outlined
                        size="small"
                        fluid
                        severity="secondary"
                        class="profile-button"
                        :label="profileLabel"
                        :title="profileLabel"
                        @click="actions?.chooseProfile(fixture.id)"
                    />
                    <Button
                        v-if="oflUrl"
                        v-tooltip.bottom="'Open OFL page'"
                        text
                        rounded
                        size="small"
                        severity="secondary"
                        icon="pi pi-external-link"
                        aria-label="Open OFL page"
                        @click="openOfl"
                    />
                </div>
            </PropertyRow>
            <PropertyRow v-if="dmx.config.definition" label="Mode">
                <Select
                    :model-value="dmx.config.mode?.name ?? null"
                    :options="dmx.config.definition.modes"
                    option-label="name"
                    option-value="name"
                    placeholder="Choose a mode"
                    size="small"
                    fluid
                    @update:model-value="setMode"
                />
            </PropertyRow>
            <PropertyRow label="Address" :hint="addressHint" :warning="addressWarning">
                <InputNumber
                    :model-value="dmx.config.startChannel"
                    :min="1"
                    :max="512"
                    :use-grouping="false"
                    size="small"
                    fluid
                    aria-label="Start channel"
                    @update:model-value="setStartChannel"
                />
            </PropertyRow>
        </template>
        <PropertyRow v-else-if="strip" label="LEDs" :hint="ledHint">
            <InputNumber
                :model-value="strip.config.numLeds"
                :min="1"
                :max="10000"
                :use-grouping="false"
                size="small"
                fluid
                aria-label="Number of LEDs"
                @update:model-value="setNumLeds"
            />
        </PropertyRow>
        <PropertyRow label="Controller">
            <Select
                :model-value="controllerId"
                :options="controllerOptions"
                option-label="name"
                option-value="id"
                size="small"
                fluid
                @update:model-value="setController"
            />
        </PropertyRow>
    </InspectorSection>
</template>

<script setup lang="ts">
import { computed, inject, ref, toRaw } from "vue";
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import Select from "primevue/select";

import { useStage } from "@/stage/stage";
import { FixtureType, type BaseFixture, type DmxFixture, type LedStripFixture } from "@/stage/fixtures";
import { StripPathSampler } from "@/visualization/fixtureVisualizations/ledStrip/stripPath";
import type { LedStripVisualizationConfig } from "@/visualization/fixtureVisualizations/ledStrip/types";
import { useScene } from "../../sceneStore";
import type { FixtureVisualizationObject } from "../../model/types";
import { EDITOR_ACTIONS_KEY } from "../editorActions";
import InspectorSection from "./InspectorSection.vue";
import PropertyRow from "./PropertyRow.vue";

/** Fixture properties of a fixture object (feature 006, contracts/inspector-ui.md → Fixture section). */
const props = defineProps<{
    object: FixtureVisualizationObject;
    fixture: BaseFixture;
}>();

const NONE = "__none__";

const store = useScene();
const stage = useStage();
const actions = inject(EDITOR_ACTIONS_KEY, null);
const section = ref<InstanceType<typeof InspectorSection>>();

const dmx = computed(() => (props.fixture.type === FixtureType.DMX ? (props.fixture as DmxFixture) : null));
const strip = computed(() => (props.fixture.type === FixtureType.LED_STRIP ? (props.fixture as LedStripFixture) : null));

// OFL definitions carry no manufacturer name, only the fixture name
const profileLabel = computed(() => dmx.value?.config.definition?.name ?? "Choose profile…");
const oflUrl = computed(() => (dmx.value?.config.definition?.oflURL as string | undefined) ?? null);

function openOfl() {
    if (oflUrl.value) {
        window.open(oflUrl.value, "_blank");
    }
}

/** Every write is one undo step; typing in a field is merged by the field's key. */
function writeConfig(patch: object, label: string, field: string) {
    store.updateFixture(props.fixture.id, { config: { ...(toRaw(props.fixture.config) as object), ...patch } }, label, `fixture:${props.fixture.id}:${field}`);
}

function setMode(name: string | null) {
    const mode = dmx.value?.config.definition?.modes.find((m) => m.name === name) ?? null;
    if (mode) {
        writeConfig({ mode }, "Change mode", "mode");
    }
}

function setStartChannel(value: number | null) {
    if (value !== null && Number.isFinite(value)) {
        writeConfig({ startChannel: Math.min(512, Math.max(1, Math.round(value))) }, "Change start channel", "startChannel");
    }
}

const channelInfo = computed(() => stage.fixtureChannelInfo(props.fixture.id));
const addressHint = computed(() => {
    const range = channelInfo.value.range;
    return range ? (range[0] === range[1] ? `Channel ${range[0]}` : `Channels ${range[0]}–${range[1]}`) : undefined;
});
const addressWarning = computed(() => {
    const { range, overlaps, exceedsUniverse } = channelInfo.value;
    const parts: string[] = [];
    if (overlaps.length > 0) {
        parts.push(`Overlaps ${overlaps.join(", ")}`);
    }
    if (exceedsUniverse && range) {
        parts.push(`Does not fit into the universe (ends at ${range[1]})`);
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
});

function setNumLeds(value: number | null) {
    if (value !== null && Number.isFinite(value)) {
        writeConfig({ numLeds: Math.min(10000, Math.max(1, Math.round(value))) }, "Change LED count", "numLeds");
    }
}

const ledHint = computed(() => {
    const path = (props.object.config as LedStripVisualizationConfig).path;
    if (!strip.value || !path) {
        return undefined;
    }
    try {
        const length = new StripPathSampler(path).length;
        return length > 0 ? `${(strip.value.config.numLeds / length).toFixed(1)} per metre` : undefined;
    } catch {
        return undefined;
    }
});

const controllerId = computed(() => stage.controllerOf(props.fixture.id)?.id ?? NONE);
const controllerOptions = computed(() => [
    { id: NONE, name: "None" },
    ...stage.controllers
        .getArray()
        .filter((c) => c.compatibleFixtures.includes(props.fixture.type))
        .map((c) => ({ id: c.id, name: c.name })),
]);

function setController(id: string) {
    store.updateFixture(props.fixture.id, { controllerId: id === NONE ? null : id }, "Change controller");
}

defineExpose({ reveal: () => section.value?.reveal() });
</script>

<style scoped>
.profile-row {
    display: flex;
    align-items: center;
    gap: var(--insp-gap-1);
    min-width: 0;
}

.profile-button {
    min-width: 0;
}

.profile-button :deep(.p-button-label) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
