<template>
    <Dialog :visible="modelValue" :style="{ width: '50vw' }" header="Settings" modal @update:visible="emit('update:modelValue', $event)">
        <div class="settings">
            <LabelledInputText v-model="vResolution">Resolution</LabelledInputText>
            <LabelledInputText v-model="vFps">FPS</LabelledInputText>
            <LabelledInputText v-model="vBridgeUrl">Bridge URL</LabelledInputText>
        </div>
        <template #footer>
            <Button label="Cancel" severity="secondary" @click="cancel"></Button>
            <Button label="Save" @click="save"></Button>
        </template>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import LabelledInputText from "@/components/LabelledInputText.vue";

import { useGlobalState } from "@/globalState";

const globalState = useGlobalState();

const props = defineProps({
    modelValue: { type: Boolean, required: true },
});

const emit = defineEmits(["update:modelValue"]);

const vResolution = ref("0");
const vFps = ref("0");
const vBridgeUrl = ref("");

watch(
    () => props.modelValue,
    () => {
        vResolution.value = globalState.resolution.toString();
        vFps.value = globalState.fps.toString();
        vBridgeUrl.value = globalState.bridgeUrl;
    },
);

function cancel() {
    emit("update:modelValue", false);
}

function save() {
    emit("update:modelValue", false);
    // TODO: Validation
    globalState.resolution = parseInt(vResolution.value, 10);
    globalState.fps = parseInt(vFps.value, 10);
    globalState.bridgeUrl = vBridgeUrl.value;
}
</script>

<style scoped>
.settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
</style>
