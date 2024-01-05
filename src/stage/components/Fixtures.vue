<template>
    <div class="fixtures">
        <div class="col-span-2 flex gap-4">
            <div>
                <Button outlined icon="pi pi-plus" label="Add Fixture" @click="menu?.toggle"></Button>
                <Menu ref="menu" :model="addFixtureOptions" :popup="true"></Menu>
            </div>
        </div>
        <Listbox v-model="selectedFixture" :options="stage.fixtures" empty-message="No fixtures added.">
            <template #option="{ option }">
                <div class="flex align-items-center">
                    <i v-if="!option.isValid" class="mdi mdi-alert mr-4" title="Please set all necessary options to use this fixture"></i>
                    <div>{{ option.name }}</div>
                </div>
            </template>
        </Listbox>
        <Panel header="Fixture Settings" class="flex flex-col" :pt="{ toggleableContent: { class: 'grow' }, content: { class: 'h-full' } }">
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
                <component v-if="selectedFixture.settingsComponent" :is="selectedFixture.settingsComponent" v-model="selectedFixture" />

                <Divider />

                <LabelledFormField label="Controller">
                    <Dropdown v-model="controllerId" :options="availableControllers" option-label="name" option-value="id" />
                </LabelledFormField>
            </div>
        </Panel>
    </div>
</template>

<script setup lang="ts">
import { Ref, computed, ref } from "vue";
import Button from "primevue/button";
import Listbox from "primevue/listbox";
import Panel from "primevue/panel";
import Chip from "primevue/chip";
import Menu, { MenuProps } from "primevue/menu";
import Divider from "primevue/divider";
import Dropdown from "primevue/dropdown";
import { useToast } from "primevue/usetoast";

import LabelledInputText from "@/components/LabelledInputText.vue";
import LabelledFormField from "@/components/LabelledFormField.vue";

import { FixtureType, BaseFixture, LedStripFixture, DmxFixture } from "../fixtures";
import { useStage } from "../stage";

const stage = useStage();
const toast = useToast();

const selectedFixture = ref<BaseFixture | null>(null) as Ref<BaseFixture | null>;
const menu = ref<Menu | null>(null);

const addFixtureOptions: MenuProps["model"] = [
    { label: "LED Strip", icon: "mdi mdi-led-on", command: () => addFixture(FixtureType.LED_STRIP) },
    { label: "DMX", icon: "mdi mdi-audio-input-xlr", command: () => addFixture(FixtureType.DMX) },
];

const controllerId = computed<string>({
    get: () => {
        if (!selectedFixture.value) {
            return "NONE";
        }
        const id = stage.controllers.find((controller) => controller.controlledFixtures.includes(selectedFixture.value!))?.id ?? "NONE";
        return id;
    },
    set: (value) => {
        try {
            const oldController = stage.controllers.find((c) => c.id === controllerId.value);
            oldController?.removeFixture(selectedFixture.value!);
            const newController = stage.controllers.find((c) => c.id === value);
            newController?.addFixture(selectedFixture.value!);
        } catch (err) {
            toast.add({
                severity: "warn",
                closable: true,
                summary: "Could not assign controller",
                detail: err instanceof Error ? err.message : String(err),
                life: 4000,
            });
        }
    },
});

const availableControllers = computed(() => {
    const controllers: Array<{ name: string; id: string }> = [{ id: "NONE", name: "None" }];
    if (selectedFixture.value) {
        controllers.push(...stage.controllers.filter((controller) => controller.compatibleFixtures.includes(selectedFixture.value!.type)));
    }
    return controllers;
});

function addFixture(type: FixtureType) {
    let newFixture: BaseFixture;
    switch (type) {
        case FixtureType.LED_STRIP:
            newFixture = new LedStripFixture();
            break;
        case FixtureType.DMX:
            newFixture = new DmxFixture();
            break;
        default:
            throw new Error(`Unknown fixture type ${type}`);
    }
    stage.fixtures.push(newFixture);
}

function removeSelectedFixture() {
    if (!selectedFixture.value) {
        return;
    }

    stage.fixtures = stage.fixtures.filter((fixture) => fixture !== selectedFixture.value);
    selectedFixture.value = null;
}
</script>

<style scoped>
.fixtures {
    width: 100%;
    height: 100%;
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr 2fr;
    grid-template-rows: min-content auto;
}

.fixture-settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
</style>
