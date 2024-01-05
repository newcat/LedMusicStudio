<template>
    <div class="fixture-settings">
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
            <Dropdown v-model="visualization" :options="visualizationTypes" option-label="label" option-value="value" />
        </LabelledFormField>
        <component
            v-if="fixture.visualization?.settingsComponent"
            :is="fixture.visualization.settingsComponent"
            :visualization="fixture.visualization"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Chip from "primevue/chip";
import Dropdown from "primevue/dropdown";
import Divider from "primevue/divider";
import { useToast } from "primevue/usetoast";

import LabelledInputText from "@/components/LabelledInputText.vue";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { BaseFixture } from "../fixtures";
import { useStage } from "../stage";
import { createFixtureVisualization } from "../visualization/fixtureVisualizations/factory";
import { VisualizationType } from "../visualization/fixtureVisualizations/base.visualization";

const props = defineProps<{
    fixture: BaseFixture;
}>();

const toast = useToast();
const stage = useStage();

const controllerId = computed<string>({
    get: () => {
        const id = stage.controllers.getArray().find((controller) => controller.controlledFixtures.includes(props.fixture))?.id ?? "NONE";
        return id;
    },
    set: (value) => {
        try {
            const oldController = stage.controllers.get(controllerId.value);
            oldController?.removeFixture(props.fixture);
            const newController = stage.controllers.get(value);
            newController?.addFixture(props.fixture);
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
    if (props.fixture.value) {
        controllers.push(
            ...stage.controllers.getArray().filter((controller) => controller.compatibleFixtures.includes(props.fixture.type))
        );
    }
    return controllers;
});

const visualization = computed({
    get() {
        return props.fixture.visualization?.type ?? "NONE";
    },
    set(newType) {
        try {
            if (props.fixture.visualization) {
                // TODO: Remove old visualization from scene
                props.fixture.visualization.dispose();
            }

            if (newType === "NONE") {
                props.fixture.visualization = null;
            } else {
                props.fixture.visualization = createFixtureVisualization(newType, props.fixture);
            }
        } catch (err) {
            toast.add({
                severity: "warn",
                closable: true,
                summary: "Could not update visualizatino",
                detail: err instanceof Error ? err.message : String(err),
                life: 4000,
            });
        }
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
