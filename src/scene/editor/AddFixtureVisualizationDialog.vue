<template>
    <Dialog v-model:visible="visible" modal header="Add fixture visualization" :style="{ width: '26rem' }">
        <div class="flex flex-col gap-4">
            <LabelledFormField label="Fixture">
                <Select
                    v-model="fixtureId"
                    :options="fixtureOptions"
                    option-label="label"
                    option-value="value"
                    placeholder="Choose a fixture"
                    empty-message="All fixtures already have a visualization."
                />
            </LabelledFormField>
            <LabelledFormField label="Visualization type">
                <Select v-model="type" :options="typeOptions" option-label="label" option-value="value" placeholder="Choose a type" />
            </LabelledFormField>
        </div>
        <template #footer>
            <Button text label="Cancel" @click="visible = false" />
            <Button label="Add" :disabled="!fixtureId || !type" @click="confirm" />
        </template>
    </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Dialog from "primevue/dialog";
import Select from "primevue/select";
import Button from "primevue/button";

import LabelledFormField from "@/components/LabelledFormField.vue";
import { useStage } from "@/stage/stage";
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { getVisualizationByType } from "@/visualization/fixtureVisualizations/factory";
import { useScene } from "../sceneStore";

const visible = defineModel<boolean>("visible", { required: true });

const emit = defineEmits<{
    confirm: [fixtureId: string, type: VisualizationType];
}>();

const stage = useStage();
const store = useScene();

const fixtureId = ref<string | null>(null);
const type = ref<VisualizationType | null>(null);

/** Only fixtures without a visualization object. */
const fixtureOptions = computed(() =>
    stage.fixtures
        .getArray()
        .filter((fixture) => !store.findObjectByFixture(fixture.id))
        .map((fixture) => ({ label: fixture.name, value: fixture.id }))
);

/** Only types that are compatible with the chosen fixture. */
const typeOptions = computed(() => {
    const fixture = fixtureId.value ? stage.fixtures.get(fixtureId.value) : undefined;
    if (!fixture) {
        return [];
    }
    return Object.values(VisualizationType)
        .filter((t) => getVisualizationByType(t).compatibleFixtures.includes(fixture.type))
        .map((t) => ({ label: t, value: t }));
});

watch(fixtureId, () => {
    type.value = typeOptions.value.length === 1 ? typeOptions.value[0].value : null;
});

watch(visible, (isVisible) => {
    if (isVisible) {
        fixtureId.value = null;
        type.value = null;
    }
});

function confirm() {
    if (fixtureId.value && type.value) {
        emit("confirm", fixtureId.value, type.value);
        visible.value = false;
    }
}
</script>
