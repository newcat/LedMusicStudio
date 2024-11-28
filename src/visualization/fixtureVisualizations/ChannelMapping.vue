<template>
    <div class="font-bold">{{ label }}</div>
    <LabelledFormField label="Channel">
        <DmxChannelSelector v-model="channel" :fixture="fixture" />
    </LabelledFormField>
    <template v-if="typeof mapping === 'object'">
        <LabelledFormField label="Minimum">
            <InputNumber v-model="mapping.min" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Maximum">
            <InputNumber v-model="mapping.max" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField v-if="channel === -1" label="Default">
            <InputNumber v-model="mapping.defaultValue" :max-fraction-digits="3" />
        </LabelledFormField>
        <div v-else></div>
    </template>
    <template v-else>
        <div></div>
        <div></div>
        <div></div>
    </template>
</template>

<script setup lang="ts">
import DmxChannelSelector from "./DmxChannelSelector.vue";
import InputNumber from "primevue/inputnumber";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { DmxFixture } from "@/stage";
import { ChannelMapping } from "./types";
import { computed } from "vue";

const mapping = defineModel<number | ChannelMapping>({ required: true });

defineProps<{
    label: string;
    fixture: DmxFixture;
}>();

const channel = computed({
    get: () => {
        if (typeof mapping.value === "number") {
            return mapping.value;
        }
        return mapping.value.channel;
    },
    set: (value: number) => {
        if (typeof mapping.value === "number") {
            mapping.value = value;
        } else {
            mapping.value.channel = value;
        }
    },
});
</script>
