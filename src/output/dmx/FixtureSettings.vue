<template>
    <Panel header="Fixture Settings">
        <template #icons>
            <button v-tooltip.left="'Remove Fixture'" class="p-panel-header-icon p-link" @click="emit('remove')">
                <span class="pi pi-trash"></span>
            </button>
        </template>

        <div class="fixture-settings">
            <div>
                <Chip>{{ fixture.definition.name }}</Chip>
            </div>
            <LabelledInputText v-model="fixture.name">Name</LabelledInputText>
            <div>
                <LabelledFormField label="Start Channel">
                    <InputNumber v-model="fixture.startChannel"></InputNumber>
                </LabelledFormField>
            </div>
            <div>
                <LabelledFormField label="Mode">
                    <Dropdown v-model="fixture.mode" :options="fixture.definition.modes" option-label="name"></Dropdown>
                </LabelledFormField>
            </div>
        </div>
    </Panel>
</template>

<script setup lang="ts">
import Panel from "primevue/panel";
import Chip from "primevue/chip";
import Dropdown from "primevue/dropdown";
import InputNumber from "primevue/inputnumber";
import LabelledInputText from "@/components/LabelledInputText.vue";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { DmxFixture } from "./fixture";

const props = defineProps<{
    fixture: DmxFixture;
}>();

const emit = defineEmits<{
    (e: "remove"): void;
}>();
</script>

<style scoped>
.fixture-settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
</style>
