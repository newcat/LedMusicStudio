<template>
    <n-modal :show="modelValue" @update:show="emit('update:modelValue', $event)" preset="card" title="Settings">
        <n-form-item label="Resolution">
            <n-input v-model="vResolution"></n-input>
        </n-form-item>
        <n-form-item label="FPS">
            <n-input v-model="vFps"></n-input>
        </n-form-item>
        <template #action>
            <n-button @click="cancel">Cancel</n-button>
            <n-button @click="save">Save</n-button>
        </template>
    </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NModal, NFormItem, NInput, NButton } from "naive-ui";

import { globalState } from "@/globalState";

const props = defineProps({
    modelValue: { type: Boolean, required: true },
});

const emit = defineEmits(["update:modelValue"]);

const vResolution = ref("0");
const vFps = ref("0");

watch(
    () => props.modelValue,
    () => {
        vResolution.value = globalState.resolution.toString();
        vFps.value = globalState.fps.toString();
    }
);

function cancel() {
    emit("update:modelValue", false);
}

function save() {
    emit("update:modelValue", false);
    // TODO: Validation
    globalState.resolution = parseInt(vResolution.value, 10);
    globalState.fps = parseInt(vFps.value, 10);
}
</script>
