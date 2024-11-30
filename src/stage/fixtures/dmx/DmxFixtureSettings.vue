<template>
    <div class="flex gap-4 items-center">
        <Button label="Choose Fixture" outlined @click="showFixtureDialog = true" />
        <div v-if="fixture.config.definition">{{ fixture.config.definition.name }}</div>
        <Button
            v-if="fixture.config.definition?.oflURL"
            v-tooltip.left="'Open OFL page'"
            text
            rounded
            severity="secondary"
            @click="openOflPage"
        >
            <span class="pi pi-external-link"></span>
        </Button>
    </div>

    <template v-if="fixture.config.definition">
        <div>
            <LabelledFormField label="Start Channel">
                <InputNumber
                    :model-value="fixture.config.startChannel"
                    :min="1"
                    :max="512"
                    @update:model-value="setStartChannel"
                ></InputNumber>
            </LabelledFormField>
        </div>
        <div>
            <LabelledFormField label="Mode">
                <Select
                    :model-value="fixture.config.mode"
                    :options="fixture.config.definition.modes"
                    option-label="name"
                    @update:model-value="setMode"
                ></Select>
            </LabelledFormField>
        </div>
    </template>

    <ChooseFixtureDialog v-model="showFixtureDialog" @set-fixture="setFixture" />
</template>

<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import Select from "primevue/select";

import LabelledFormField from "@/components/LabelledFormField.vue";
import { DmxFixture } from "./dmx.fixture";
import ChooseFixtureDialog from "./ChooseFixtureDialog.vue";
import { Fixture as OpenFixtureDefinition } from "./open-fixture";

const props = defineProps<{
    fixture: DmxFixture;
}>();

const showFixtureDialog = ref(false);

function setFixture(definition: OpenFixtureDefinition) {
    props.fixture.setConfig({
        ...props.fixture.config,
        definition,
        mode: definition.modes[0],
    });
}

function setStartChannel(startChannel: number) {
    props.fixture.setConfig({
        ...props.fixture.config,
        startChannel,
    });
}

function setMode(mode: OpenFixtureDefinition["modes"][number]) {
    props.fixture.setConfig({
        ...props.fixture.config,
        mode,
    });
}

function openOflPage() {
    window.open(props.fixture.config.definition!.oflURL as string, "_blank");
}
</script>
