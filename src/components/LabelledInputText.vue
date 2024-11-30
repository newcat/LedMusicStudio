<template>
    <div class="labelled-input-text">
        <label :for="id"><slot></slot></label>
        <InputText :id="id" v-model="value"></InputText>
    </div>
</template>

<script setup lang="ts">
import { useVModel } from "@vueuse/core";
import { v4 as uuidv4 } from "uuid";
import InputText from "primevue/inputtext";

const props = defineProps<{
    modelValue: string;
}>();

const emit = defineEmits<(e: "update:modelValue", v: string) => void>();

const id = uuidv4();

const value = useVModel(props, "modelValue", emit);
</script>

<style scoped>
.labelled-input-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}
</style>
