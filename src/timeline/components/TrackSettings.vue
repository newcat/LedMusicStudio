<template>
    <n-modal :show="modelValue" @update:show="emit('update:modelValue', $event)" preset="card" title="Loading">
        <n-form-item label="Name">
            <n-input v-model="vName"></n-input>
        </n-form-item>
        <template #action>
            <n-button @click="cancel">Cancel</n-button>
            <n-button @click="save">Save</n-button>
        </template>
    </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NModal, NFormItem, NInput } from "naive-ui";

import { Track } from "../model";

const props = defineProps({
    modelValue: { type: Boolean, required: true },
    track: { type: Object as () => Track, required: true },
});

const emit = defineEmits(["update:modelValue"]);

const vName = ref("");

watch(
    () => props.modelValue,
    () => {
        vName.value = props.track.name;
    }
);

function cancel() {
    emit("update:modelValue", false);
}

function save() {
    emit("update:modelValue", false);
    props.track.name = vName.value;
}
</script>
