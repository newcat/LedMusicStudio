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
        <component :is="fixture.settingsComponent" v-if="fixture.settingsComponent" :fixture="fixture" />

        <Divider />

        <LabelledFormField label="Controller">
            <Select v-model="controllerId" :options="availableControllers" option-label="name" option-value="id" />
        </LabelledFormField>

        <Divider />

        <LabelledFormField label="Visualization">
            <Select v-model="visualizationType" :options="visualizationTypes" option-label="label" option-value="value" />
        </LabelledFormField>
        <template v-if="visObject && visController">
            <component
                :is="visController.visualization.settingsComponent"
                v-if="visController.visualization.settingsComponent"
                :config="visObject.config"
                :controller="visController"
                :model-id="visObject.modelId"
                @update:config="updateConfig"
            />
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Chip from "primevue/chip";
import Select from "primevue/select";
import Divider from "primevue/divider";
import Message from "primevue/message";

import { useErrorHandler } from "@/utils";
import LabelledInputText from "@/components/LabelledInputText.vue";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { useScene } from "@/scene/sceneStore";
import { modelForType } from "@/scene/fixtureModels";
import type { SceneObject } from "@/scene/model/types";
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

const scene = useScene();

const visObject = computed(() => scene.findObjectByFixture(props.fixture.id));
const visController = computed(() => (visObject.value ? stage.visualization.controllers.get(visObject.value.id) : undefined));
const visualizationType = computed<VisualizationType | "NONE">({
    get() {
        return visObject.value?.visualizationType ?? "NONE";
    },
    set(newType) {
        void errorHandler("Could not update visualization", () => {
            const object = visObject.value;
            if (newType === "NONE") {
                if (object) {
                    scene.removeObjects([object.id], true, "Remove fixture visualization");
                }
            } else if (object) {
                // also applies the mapped (or default) model of the new type (feature 002, invariant 2)
                scene.setVisualizationType(object.id, newType);
            } else {
                // feature 002: model and model scale come from the category preselection when its type matches
                scene.addFixtureVisualization(props.fixture.id, newType, undefined, modelForType(props.fixture, newType, true));
            }
        });
    },
});

function updateConfig(config: unknown) {
    if (visObject.value) {
        scene.updateObjects({ [visObject.value.id]: { config } as Partial<SceneObject> }, "Edit visualization", `config:${visObject.value.id}`);
    }
}

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
    overflow: auto;
}
</style>
