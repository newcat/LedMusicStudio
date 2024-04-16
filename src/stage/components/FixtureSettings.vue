<template>
    <div class="fixture-settings">
        <div>
            <Message v-if="fixture.validationErrors.length > 0" severity="warn" :closable="false">
                <ul class="m-0">
                    <li v-for="error in fixture.validationErrors" :key="error">{{ error }}</li>
                </ul>
            </Message>
        </div>

        <div>
            <Chip>{{ fixture.type }}</Chip>
        </div>
        <LabelledInputText v-model="fixture.name">Name</LabelledInputText>
        <component v-if="fixture.settingsComponent" :is="fixture.settingsComponent" :fixture="fixture" />

        <Divider />

        <LabelledFormField label="Controller">
            <Dropdown v-model="controllerId" :options="availableControllers" option-label="name" option-value="id" />
        </LabelledFormField>

        <Divider />

        <LabelledFormField label="Visualization">
            <Dropdown v-model="visualizationType" :options="visualizationTypes" option-label="label" option-value="value" />
        </LabelledFormField>
        <template v-if="visController">
            <component
                v-if="visController.visualization.settingsComponent"
                :is="visController.visualization.settingsComponent"
                v-model:config="visController.config"
                :controller="visController"
            />
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Chip from "primevue/chip";
import Dropdown from "primevue/dropdown";
import Divider from "primevue/divider";
import Message from "primevue/message";

import { useErrorHandler } from "@/utils";
import LabelledInputText from "@/components/LabelledInputText.vue";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { BaseFixture } from "../fixtures";
import { useStage } from "../stage";

const props = defineProps<{
    fixture: BaseFixture;
}>();

const errorHandler = useErrorHandler();
const stage = useStage();

const controllerId = computed<string>({
    get: () => {
        const id = stage.controllers.getArray().find((controller) => controller.controlledFixtures.includes(props.fixture))?.id ?? "NONE";
        return id;
    },
    set: (value) => {
        void errorHandler("Could not assign controller", () => {
            const oldController = stage.controllers.get(controllerId.value);
            oldController?.removeFixture(props.fixture);
            const newController = stage.controllers.get(value);
            newController?.addFixture(props.fixture);
        });
    },
});

const availableControllers = computed(() => {
    const controllers: Array<{ name: string; id: string }> = [{ id: "NONE", name: "None" }];
    if (props.fixture.value) {
        controllers.push(
            ...stage.controllers.getArray().filter((controller) => controller.compatibleFixtures.includes(props.fixture.type))
        );
    }
    return controllers;
});

const visController = computed(() => stage.visualization.controllers.get(props.fixture.id));
const visualizationType = computed<VisualizationType | "NONE">({
    get() {
        return visController.value?.visualization.type ?? "NONE";
    },
    set(newType) {
        void errorHandler("Could not update visualization", () => {
            stage.visualization.setVisualization(props.fixture.id, newType === "NONE" ? null : newType);
        });
    },
});

const visualizationTypes = computed(() => {
    const types: Array<{ label: string; value: "NONE" | VisualizationType }> = [
        { label: "None", value: "NONE" },
        ...Object.values(VisualizationType).map((type) => ({ label: type, value: type })),
    ];
    return types;
});
</script>

<style scoped>
.fixture-settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
</style>
