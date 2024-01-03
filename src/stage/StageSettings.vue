<template>
    <div class="stage-settings">
        <div class="col-span-2 flex gap-4">
            <div>
                <Button outlined label="Load Scene" @click="loadScene" />
            </div>
            <div>
                <Button :disabled="!stage.scene" outlined icon="pi pi-plus" label="Add Fixture" @click="menu?.toggle"></Button>
                <Menu ref="menu" :model="addFixtureOptions" :popup="true"></Menu>
            </div>
            <div>
                <Button :disabled="!stage.scene || !canApply" outlined label="Apply" @click="applyFixtures" />
            </div>
        </div>
        <Listbox class="fixture-list" v-model="selectedFixture" :options="fixtures" empty-message="No fixtures added.">
            <template #option="{ option }">
                <div class="flex align-items-center">
                    <i v-if="!option.isValid" class="mdi mdi-alert mr-4" title="Please set all necessary options to use this fixture"></i>
                    <div>{{ option.name }}</div>
                </div>
            </template>
        </Listbox>
        <Panel header="Fixture Settings">
            <template #icons>
                <button
                    v-tooltip.left="'Remove Fixture'"
                    class="p-panel-header-icon p-link"
                    :disabled="!selectedFixture"
                    @click="removeSelectedFixture"
                >
                    <span class="pi pi-trash"></span>
                </button>
            </template>

            <div v-if="selectedFixture" class="fixture-settings">
                <div>
                    <Chip>{{ selectedFixture.type }}</Chip>
                </div>
                <LabelledInputText v-model="selectedFixture.name">Name</LabelledInputText>
                <LabelledFormField label="Output">
                    <Dropdown v-model="selectedFixture.outputId" :options="outputOptions" option-label="name" option-value="id"></Dropdown>
                </LabelledFormField>
                <component
                    v-if="selectedFixture.settingsComponent"
                    :is="selectedFixture.settingsComponent"
                    v-model="selectedFixture"
                    :stage="stage"
                />
            </div>
        </Panel>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import Button from "primevue/button";
import Listbox from "primevue/listbox";
import Panel from "primevue/panel";
import Chip from "primevue/chip";
import Dropdown from "primevue/dropdown";
import Menu, { MenuProps } from "primevue/menu";

import { readFile, showOpenDialog } from "@/native";
import { useLibrary } from "@/library";
import LabelledInputText from "@/components/LabelledInputText.vue";
import LabelledFormField from "@/components/LabelledFormField.vue";

import { StageLibraryItem } from "./stage.libraryItem";
import { BaseStageFixture, LedStripStageFixture, StageFixtureType } from "./fixtures";
import { isOutputLibraryItem } from "@/utils";

const props = defineProps<{
    stage: StageLibraryItem;
}>();

const library = useLibrary();

const canApply = ref(false);
const fixtures = ref<BaseStageFixture[]>([]);
const selectedFixture = ref<BaseStageFixture | null>(null);
const menu = ref<Menu | null>(null);

const addFixtureOptions: MenuProps["model"] = [
    { label: "LED Strip", icon: "mdi mdi-led-on", command: () => addFixture(StageFixtureType.LED_STRIP) },
];
const outputOptions = computed(() =>
    library.items.filter(
        (item) => isOutputLibraryItem(item) && selectedFixture.value?.compatibleOutputTypes.includes(item.outputInstance.type)
    )
);

onMounted(async () => {
    fixtures.value = props.stage.fixtures;
    // needed, because the watcher is triggered by the statement above but only after the tick is processed
    await nextTick();
    canApply.value = false;
});

watch(
    fixtures,
    () => {
        canApply.value = true;
    },
    { deep: true }
);

async function loadScene() {
    const result = await showOpenDialog({ title: "Load Scene", filters: [{ name: "Stage Scene", extensions: ["json"] }] });
    if (result.canceled || result.filePaths.length !== 1) {
        return;
    }

    const timeoutSymbol = Symbol("timeout");
    const rawData = await Promise.race([
        readFile(result.filePaths[0], { encoding: "utf-8" }),
        new Promise<symbol>((res) => setTimeout(res, 5000, timeoutSymbol)),
    ]);
    if (rawData === timeoutSymbol) {
        throw new Error("Timeout while reading data");
    }

    props.stage.createScene(JSON.parse(rawData as string));
}

function addFixture(type: StageFixtureType) {
    let newFixture: BaseStageFixture;
    switch (type) {
        case StageFixtureType.LED_STRIP:
            newFixture = new LedStripStageFixture();
            break;
        default:
            throw new Error(`Unknown fixture type ${type}`);
    }
    fixtures.value.push(newFixture);
}

function applyFixtures() {
    props.stage.applyFixtures(fixtures.value);
    canApply.value = false;
}

function removeSelectedFixture() {
    if (!selectedFixture.value) {
        return;
    }

    fixtures.value = fixtures.value.filter((fixture) => fixture !== selectedFixture.value);
    selectedFixture.value = null;
}
</script>

<style scoped>
.stage-settings {
    margin: 1rem;
    height: calc(100% - 2rem);
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: min-content auto;
}

.fixture-settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
</style>
