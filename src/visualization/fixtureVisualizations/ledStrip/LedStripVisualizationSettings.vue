<template>
    <LabelledFormField label="Intensity">
        <InputNumber v-model="config.intensity" :max-fraction-digits="5" />
    </LabelledFormField>
    <div class="flex gap-3">
        <LabelledFormField label="Start X (local, m)">
            <InputNumber v-model="config.start[0]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Start Y (local, m)">
            <InputNumber v-model="config.start[1]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Start Z (local, m)">
            <InputNumber v-model="config.start[2]" :max-fraction-digits="3" />
        </LabelledFormField>
    </div>
    <div class="flex gap-3">
        <LabelledFormField label="End X (local, m)">
            <InputNumber v-model="config.end[0]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="End Y (local, m)">
            <InputNumber v-model="config.end[1]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="End Z (local, m)">
            <InputNumber v-model="config.end[2]" :max-fraction-digits="3" />
        </LabelledFormField>
    </div>
    <div class="text-sm opacity-70">The strip emits along the object's local +Y axis.</div>
</template>

<script setup lang="ts">
import InputNumber from "primevue/inputnumber";

import LabelledFormField from "@/components/LabelledFormField.vue";
import { LedStripVisualizationConfig } from "./types";
import { useLiveConfig } from "../useLiveConfig";

defineOptions({ inheritAttrs: false });

const model = defineModel<LedStripVisualizationConfig>("config", { required: true });
const config = useLiveConfig(model, (value) => (model.value = value));
</script>
