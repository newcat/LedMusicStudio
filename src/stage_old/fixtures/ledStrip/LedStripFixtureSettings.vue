<template>
    <LabelledFormField label="Mesh">
        <Dropdown v-model="fixture.meshId" :options="meshOptions" option-label="name" option-value="id"></Dropdown>
    </LabelledFormField>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Dropdown from "primevue/dropdown";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { StageLibraryItem } from "../../stage.libraryItem";
import type { LedStripStageFixture } from "./ledStrip.fixture";

const props = defineProps<{
    stage: StageLibraryItem;
}>();

const fixture = defineModel<LedStripStageFixture>({ required: true });

const meshOptions = computed(() => {
    if (!props.stage.scene) {
        return [];
    }

    return props.stage.scene.scene.children.map((mesh) => ({
        id: mesh.uuid,
        name: mesh.name,
    }));
});
</script>
