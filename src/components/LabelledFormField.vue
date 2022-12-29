<template>
    <div class="labelled-form-field">
        <label :for="id">{{ label }}</label>
        <slot></slot>
    </div>
</template>

<script setup lang="ts">
import { v4 as uuidv4 } from "uuid";

defineProps<{
    label: string;
}>();

const id = uuidv4();
</script>

<style scoped>
.labelled-form-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}
</style>
