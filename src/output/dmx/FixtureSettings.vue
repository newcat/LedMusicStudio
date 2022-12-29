<template>
    <Panel header="Fixture Settings">
        <div class="fixture-settings">
            <div>
                <Chip>{{ fixture.definition.name }}</Chip>
            </div>
            <LabelledInputText v-model="fixture.name">Name</LabelledInputText>
            <div>
                <LabelledFormField label="Mode">
                    <Dropdown v-model="fixture.mode" :options="fixture.definition.modes" option-label="name"></Dropdown>
                </LabelledFormField>
            </div>
        </div>
    </Panel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Panel from "primevue/panel";
import Chip from "primevue/chip";
import Dropdown from "primevue/dropdown";
import LabelledInputText from "@/components/LabelledInputText.vue";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { DmxFixture } from "./fixture";

const props = defineProps<{
    fixture: DmxFixture;
}>();
</script>

<style scoped>
.fixture-settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
</style>
