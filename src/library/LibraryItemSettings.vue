<template>
    <n-modal :show="modelValue" @update:show="emit('update:modelValue', $event)" preset="card" title="Edit Library Item">
        <n-form-item label="Name">
            <n-input v-model="vName" />
        </n-form-item>
        <template #action>
            <n-button @click="remove">Delete</n-button>
            <n-button @click="cancel">Cancel</n-button>
            <n-button @click="save">Save</n-button>
        </template>
    </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NModal, NFormItem, NInput, NButton } from "naive-ui";

import { globalState } from "@/globalState";
import { LibraryItem } from "./libraryItem";

const props = defineProps({
    modelValue: { type: Boolean, required: true },
    item: { type: Object as () => LibraryItem, required: true },
});

const emit = defineEmits(["update:modelValue"]);

const vName = ref("");

watch(
    () => props.modelValue,
    () => {
        vName.value = props.item.name;
    }
);

function remove() {
    emit("update:modelValue", false);
    globalState.library.removeItem(props.item);
}

function cancel() {
    emit("update:modelValue", false);
}

function save() {
    emit("update:modelValue", false);
    props.item.name = vName.value;
}
</script>
