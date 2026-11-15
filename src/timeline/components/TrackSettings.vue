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
                <small class="opacity-70">Looks, effects and graphs on this track that inherit their target use this one.</small>
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
import { Track, useTimeline } from "../model";

const props = defineProps({
    modelValue: { type: Boolean, required: true },
    track: { type: Object as () => Track, required: true },
});

const emit = defineEmits(["update:modelValue"]);

const timeline = useTimeline();

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
    const track = timeline.getTrackById(props.track.id);
    if (!track) {
        return;
    }
    const target = vTarget.value;
    timeline.edit("Track settings", () => {
        track.name = vName.value;
        // default target, applied live to clips that inherit (feature 005, FR-019)
        track.defaultTarget = target && target !== "clip" && target !== "inherit" ? { ...target } : null;
    });
}
</script>
