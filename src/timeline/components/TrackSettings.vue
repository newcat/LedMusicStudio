<template>
    <Dialog :visible="modelValue" header="Track Settings" @update:visible="emit('update:modelValue', $event)">
        <div class="flex flex-col gap-4">
            <div class="field flex flex-col gap-1">
                <label for="name">Name</label>
                <InputText id="name" v-model="vName" type="text" />
            </div>
            <div class="field flex flex-col gap-1">
                <label>Default target</label>
                <TargetSelect v-model="vTarget" />
                <small class="opacity-70">New looks, effects and graphs on this track get this target.</small>
            </div>
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

import TargetSelect, { type TargetSelectValue } from "@/programming/components/TargetSelect.vue";
import { Track } from "../model";

const props = defineProps({
    modelValue: { type: Boolean, required: true },
    track: { type: Object as () => Track, required: true },
});

const emit = defineEmits(["update:modelValue"]);

const vName = ref("");
const vTarget = ref<TargetSelectValue>(null);

watch(
    () => props.modelValue,
    () => {
        vName.value = props.track.name;
        vTarget.value = props.track.defaultTarget ? { ...props.track.defaultTarget } : null;
    }
);

function cancel() {
    emit("update:modelValue", false);
}

function save() {
    emit("update:modelValue", false);
    props.track.name = vName.value;
    // feature 004 (FR-018): default target new items inherit
    props.track.defaultTarget = vTarget.value && vTarget.value !== "clip" ? { ...vTarget.value } : null;
}
</script>
