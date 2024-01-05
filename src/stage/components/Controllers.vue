<template>
    <div class="controllers">
        <div class="col-span-2 flex gap-4">
            <div>
                <Button outlined icon="pi pi-plus" label="Add Controller" @click="menu?.toggle"></Button>
                <Menu ref="menu" :model="addControllerOptions" :popup="true"></Menu>
            </div>
        </div>
        <Listbox v-model="selectedController" :options="stage.controllers.getArray()" empty-message="No controllers added.">
            <template #option="{ option }">
                <div class="flex align-items-center">
                    <i
                        v-if="!option.isValid"
                        class="mdi mdi-alert mr-4"
                        title="Please set all necessary options to use this controller"
                    ></i>
                    <div>{{ option.name }}</div>
                </div>
            </template>
        </Listbox>
        <Panel
            header="Controller Settings"
            class="flex flex-col"
            :pt="{ toggleableContent: { class: 'grow' }, content: { class: 'h-full' } }"
        >
            <template #icons>
                <button
                    v-tooltip.left="'Remove Controller'"
                    class="p-panel-header-icon p-link"
                    :disabled="!selectedController"
                    @click="removeSelectedController"
                >
                    <span class="pi pi-trash"></span>
                </button>
            </template>

            <div v-if="selectedController" class="controller-settings">
                <div>
                    <Chip>{{ selectedController.type }}</Chip>
                </div>
                <LabelledInputText v-model="selectedController.name">Name</LabelledInputText>
                <component
                    v-if="selectedController.settingsComponent"
                    :is="selectedController.settingsComponent"
                    v-model="selectedController"
                />

                <Divider />

                <div>Controlled fixtures: {{ selectedController.controlledFixtures.map((f) => f.name).join(", ") }}</div>
            </div>
        </Panel>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import Listbox from "primevue/listbox";
import Panel from "primevue/panel";
import Chip from "primevue/chip";
import Menu, { MenuProps } from "primevue/menu";
import Divider from "primevue/divider";

import LabelledInputText from "@/components/LabelledInputText.vue";

import { useStage } from "../stage";
import { BaseController, ControllerType } from "../controllers";
import { createController } from "../controllers/factory";

const stage = useStage();

const selectedController = ref<BaseController | null>(null);
const menu = ref<Menu | null>(null);

const addControllerOptions: MenuProps["model"] = [
    { label: "WLED", icon: "mdi mdi-led-on", command: () => addController(ControllerType.WLED) },
    { label: "DMX", icon: "mdi mdi-audio-input-xlr", command: () => addController(ControllerType.DMX) },
    { label: "Razer Chroma", icon: "mdi mdi mdi-keyboard", command: () => addController(ControllerType.RAZER_CHROMA) },
];

function addController(type: ControllerType) {
    const newController = createController(type);
    stage.controllers.set(newController.id, newController);
}

function removeSelectedController() {
    if (!selectedController.value) {
        return;
    }

    stage.controllers.delete(selectedController.value.id);
    selectedController.value = null;
}
</script>

<style scoped>
.controllers {
    width: 100%;
    height: 100%;
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr 2fr;
    grid-template-rows: min-content auto;
}

.controller-settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
</style>
