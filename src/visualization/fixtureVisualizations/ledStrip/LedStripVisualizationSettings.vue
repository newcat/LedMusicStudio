<template>
    <div class="flex gap-3">
        <LabelledFormField label="Intensity">
            <InputNumber v-model="config.intensity" :min="0" :max="1" :step="0.05" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Pixel size">
            <InputNumber v-model="config.pixelSize" :min="0.2" :max="1" :step="0.05" :max-fraction-digits="2" />
        </LabelledFormField>
    </div>
    <div v-if="first" class="flex gap-3">
        <LabelledFormField label="Start X (local, m)">
            <InputNumber v-model="first.position[0]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Start Y (local, m)">
            <InputNumber v-model="first.position[1]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Start Z (local, m)">
            <InputNumber v-model="first.position[2]" :max-fraction-digits="3" />
        </LabelledFormField>
    </div>
    <div v-if="last" class="flex gap-3">
        <LabelledFormField label="End X (local, m)">
            <InputNumber v-model="last.position[0]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="End Y (local, m)">
            <InputNumber v-model="last.position[1]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="End Z (local, m)">
            <InputNumber v-model="last.position[2]" :max-fraction-digits="3" />
        </LabelledFormField>
    </div>
    <div class="text-sm opacity-70">The strip emits along the object's local +Y axis.</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import InputNumber from "primevue/inputnumber";

import LabelledFormField from "@/components/LabelledFormField.vue";
import { LedStripVisualizationConfig } from "./types";
import { useLiveConfig } from "../useLiveConfig";

defineOptions({ inheritAttrs: false });

const model = defineModel<LedStripVisualizationConfig>("config", { required: true });
const config = useLiveConfig(model, (value) => (model.value = value));

/** First and last path point (full path editing comes with the strip drawing tool, US4). */
const first = computed(() => config.value.path.points[0]);
const last = computed(() => config.value.path.points[config.value.path.points.length - 1]);
</script>
