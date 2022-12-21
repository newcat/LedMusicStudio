<template>
    <Dialog :visible="modelValue" @update:visible="emit('update:modelValue', $event)" header="Settings" modal>
        <div class="field">
            <label for="resolution">Resolution</label>
            <InputText v-model="vResolution" id="resolution" type="text" />
        </div>
        <div class="field">
            <label for="resolution">FPS</label>
            <InputText v-model="vFps" id="resolution" type="text" />
        </div>
        <template #footer>
            <Button @click="cancel">Cancel</Button>
            <Button @click="save">Save</Button>
        </template>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Dialog from "primevue/dialog";

import { useGlobalState } from "@/globalState";

const globalState = useGlobalState();

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
