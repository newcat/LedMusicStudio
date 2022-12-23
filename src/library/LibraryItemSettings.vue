<template>
    <Dialog :visible="modelValue" @update:visible="emit('update:modelValue', $event)" header="Edit Library Item" modal>
        <LabelledInputText v-model="vName">Name</LabelledInputText>
        <template #footer>
            <Button @click="cancel">Cancel</Button>
            <Button @click="save">Save</Button>
        </template>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";

import { LibraryItem } from "./libraryItem";
import LabelledInputText from "@/components/LabelledInputText.vue";

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

function cancel() {
    emit("update:modelValue", false);
}

function save() {
    emit("update:modelValue", false);
    props.item.name = vName.value;
}
</script>
