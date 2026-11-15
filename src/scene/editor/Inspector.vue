<template>
    <div class="inspector">
        <div v-if="!active" class="empty">Nothing selected</div>
        <template v-else>
            <div class="header">
                <i :class="['mdi', iconFor(active), 'kind-icon']" :title="kindLabel" aria-hidden="true"></i>
                <InputText v-model="nameDraft" size="small" fluid class="name" aria-label="Name" @blur="commitName" @keydown.enter="commitName" />
                <Button text rounded size="small" severity="secondary" icon="pi pi-ellipsis-v" aria-label="More actions" @click="menu?.toggle($event)" />
                <Menu ref="menu" :model="menuItems" popup />
            </div>
            <div v-if="store.selection.length > 1" class="multi">{{ store.selection.length }} objects selected, edits apply to all</div>

            <div v-else-if="problems.length > 0" class="problems">
                <Message severity="warn" size="small" :closable="false">
                    <div class="problem-list">
                        <button v-for="problem in problems" :key="problem.label" type="button" class="problem" @click="problem.reveal()">
                            {{ problem.label }}
                        </button>
                    </div>
                </Message>
            </div>

            <InspectorSection name="transform" title="Transform">
                <TransformFields />
            </InspectorSection>

            <template v-if="store.selection.length === 1">
                <InspectorSection v-if="isShape(active)" name="shape" title="Shape">
                    <ShapeProperties :object="active" />
                </InspectorSection>
                <template v-else-if="isFixtureVisualization(active)">
                    <FixtureSection v-if="fixture" ref="fixtureSection" :object="active" :fixture="fixture" />
                    <FixtureVisualizationProperties ref="visualizationProperties" :object="active" />
                    <InspectorSection v-if="dmxFixture?.config.definition && dmxFixture.config.mode" name="defaults" title="Defaults" :default-open="false">
                        <FixtureDefaults :fixture="dmxFixture" />
                    </InspectorSection>
                </template>
                <InspectorSection v-else-if="isImportedModel(active)" name="model" title="Model">
                    <ImportedModelProperties :object="active" />
                </InspectorSection>
                <InspectorSection v-else-if="isLibraryAsset(active)" name="asset" title="Asset">
                    <LibraryAssetProperties :object="active" />
                </InspectorSection>
                <div v-else-if="!isKnownKind(active.kind)" class="hint">Created by a newer version – only transform can be edited</div>
            </template>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, inject, ref, watch } from "vue";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Menu from "primevue/menu";
import Message from "primevue/message";
import type { MenuItem } from "primevue/menuitem";

import { useStage } from "@/stage/stage";
import { FixtureType, type DmxFixture } from "@/stage/fixtures";
import type { CapabilityMapping } from "@/visualization/capabilities/types";
import { useScene } from "../sceneStore";
import { isFixtureVisualization, isImportedModel, isKnownKind, isLibraryAsset, isShape } from "../model/types";
import { iconFor } from "./objectIcons";
import { EDITOR_ACTIONS_KEY } from "./editorActions";
import InspectorSection from "./inspector/InspectorSection.vue";
import TransformFields from "./inspector/TransformFields.vue";
import ShapeProperties from "./inspector/ShapeProperties.vue";
import FixtureSection from "./inspector/FixtureSection.vue";
import FixtureVisualizationProperties from "./inspector/FixtureVisualizationProperties.vue";
import ImportedModelProperties from "./inspector/ImportedModelProperties.vue";
import LibraryAssetProperties from "./inspector/LibraryAssetProperties.vue";

// async: the programming module imports the stage store
const FixtureDefaults = defineAsyncComponent(() => import("@/programming/components/FixtureDefaults.vue"));

const store = useScene();
const stage = useStage();
const actions = inject(EDITOR_ACTIONS_KEY, null);

const KIND_LABELS: Record<string, string> = {
    shape: "Shape",
    fixtureVisualization: "Fixture",
    importedModel: "Imported model",
    group: "Group",
    libraryAsset: "Library asset",
    aimTarget: "Aim target",
};

const active = computed(() => (store.activeId ? store.scene.objects[store.activeId] : undefined));
const kindLabel = computed(() => (active.value ? (KIND_LABELS[active.value.kind] ?? active.value.kind) : ""));

const fixture = computed(() => {
    const obj = active.value;
    return obj && isFixtureVisualization(obj) && obj.fixtureId ? stage.fixtures.get(obj.fixtureId) : undefined;
});
const dmxFixture = computed(() => (fixture.value?.type === FixtureType.DMX ? (fixture.value as DmxFixture) : undefined));

const menu = ref<InstanceType<typeof Menu>>();
const fixtureSection = ref<InstanceType<typeof FixtureSection>>();
const visualizationProperties = ref<InstanceType<typeof FixtureVisualizationProperties>>();

const menuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [
        { label: "Duplicate", icon: "mdi mdi-content-duplicate", command: () => store.duplicateSelection() },
        { label: "Delete", icon: "mdi mdi-delete", command: () => (actions ? actions.deleteSelection() : store.deleteSelection()) },
    ];
    const oflUrl = dmxFixture.value?.config.definition?.oflURL as string | undefined;
    if (oflUrl) {
        items.push({ separator: true }, { label: "Open OFL page", icon: "pi pi-external-link", command: () => window.open(oflUrl, "_blank") });
    }
    return items;
});

/** Validation summary (FR-017): each entry opens and scrolls to the section that fixes it. */
const problems = computed<Array<{ label: string; reveal: () => void }>>(() => {
    const obj = active.value;
    const f = fixture.value;
    if (!obj || !isFixtureVisualization(obj) || !f) {
        return [];
    }
    const toFixture = () => fixtureSection.value?.reveal();
    const result: Array<{ label: string; reveal: () => void }> = [];
    const dmx = dmxFixture.value;
    if (dmx && !dmx.config.definition) {
        result.push({ label: "No DMX profile", reveal: toFixture });
    } else if (dmx && !dmx.config.mode) {
        result.push({ label: "No mode", reveal: toFixture });
    }
    if (!stage.controllerOf(f.id)) {
        result.push({ label: "No controller", reveal: toFixture });
    }
    const overlaps = stage.fixtureChannelInfo(f.id).overlaps;
    if (overlaps.length > 0) {
        result.push({ label: `Channels overlap with ${overlaps.join(", ")}`, reveal: toFixture });
    }
    const mapping = (obj.config as { mapping?: CapabilityMapping }).mapping;
    if (dmx && mapping && mapping.mappedMode !== null && (dmx.config.mode?.name !== mapping.mappedMode || dmx.channelNames.length !== mapping.mappedChannelCount)) {
        result.push({ label: "Mapping may be outdated", reveal: () => visualizationProperties.value?.revealMapping() });
    }
    return result;
});

const nameDraft = ref("");
watch(
    () => active.value?.name,
    (name) => (nameDraft.value = name ?? ""),
    { immediate: true }
);

/** Empty names are rejected (data-model: non-empty after trimming). */
function commitName() {
    if (!active.value) {
        return;
    }
    if (nameDraft.value.trim().length === 0) {
        nameDraft.value = active.value.name;
        return;
    }
    store.rename(active.value.id, nameDraft.value);
}
</script>

<style scoped>
.inspector {
    --insp-gap-1: 4px;
    --insp-gap-2: 8px;
    --insp-gap-3: 12px;
    --insp-gap-4: 16px;
    container: inspector / inline-size;
    display: flex;
    flex-direction: column;
    overflow: auto;
    height: 100%;
}

.empty,
.hint,
.multi {
    padding: var(--insp-gap-2) var(--insp-gap-3);
    color: var(--p-text-muted-color);
    font-size: 0.8125rem;
}

.header {
    display: flex;
    gap: var(--insp-gap-2);
    align-items: center;
    padding: var(--insp-gap-2) var(--insp-gap-3);
    border-bottom: 1px solid var(--p-content-border-color);
}

.kind-icon {
    font-size: 1.1rem;
    color: var(--p-text-muted-color);
}

.name {
    flex: 1;
    min-width: 0;
}

.problems {
    padding: var(--insp-gap-2) var(--insp-gap-3);
    border-bottom: 1px solid var(--p-content-border-color);
}

.problem-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--insp-gap-1) var(--insp-gap-3);
}

.problem {
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    font-size: 0.8125rem;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
}
</style>
