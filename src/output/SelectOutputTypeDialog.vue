<template>
    <Dialog :visible="modelValue" @update:visible="emit('update:modelValue', $event)" header="Add Output" modal>
        <Listbox v-model="selectedType" :options="OUTPUT_TYPES">
            <template #option="{ option }">
                <i :class="option.icon"></i>
                {{ option.name }}
            </template>
        </Listbox>
        <template #footer>
            <Button class="p-button-outlined" label="Cancel" @click="cancel"></Button>
            <Button label="Add" :disabled="!selectedType" @click="add"></Button>
        </template>
    </Dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import Listbox from "primevue/listbox";
import { OutputTypeMetadata, OUTPUT_TYPES } from "./outputTypes";
import { LibraryItem } from "@/library";
import { OutputLibraryItem } from "./output.libraryItem";
import { createOutput } from "./outputFactory";

const props = defineProps<{ modelValue: boolean }>();

const emit = defineEmits<{
    (e: "update:modelValue", v: boolean): void;
    (e: "createOutput", output: LibraryItem): void;
}>();

const selectedType = ref<OutputTypeMetadata | null>(null);

function cancel() {
    emit("update:modelValue", false);
}

function add() {
    emit("update:modelValue", false);
    const item = new OutputLibraryItem(createOutput(selectedType.value!.type));
    item.name = selectedType.value!.name;
    emit("createOutput", item);
}
</script>
