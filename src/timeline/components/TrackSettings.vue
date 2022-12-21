<template>
    <Dialog :visible="modelValue" @update:visible="emit('update:modelValue', $event)" header="Track Settings">
        <div class="field">
            <label for="name">Name</label>
            <InputText v-model="vName" id="name" type="text" />
        </div>
        <template #footer>
            <Button @click="cancel">Cancel</Button>
            <Button @click="save">Save</Button>
        </template>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Button from "primevue/button";

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
