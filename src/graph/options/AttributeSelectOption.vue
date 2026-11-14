<template>
    <select class="baklava-input attribute-select" :value="''" :disabled="available.length === 0" @change="onChange">
        <option value="" disabled>{{ available.length > 0 ? "+ Add attribute" : "All attributes added" }}</option>
        <option v-for="key in available" :key="key" :value="key">{{ ATTRIBUTES[key].label }}</option>
    </select>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ATTRIBUTE_KEYS, ATTRIBUTES, type AttributeKey } from "@/programming/attributes";

const modelValue = defineModel<AttributeKey[]>({ required: true });

const available = computed(() => ATTRIBUTE_KEYS.filter((key) => !modelValue.value.includes(key)));

function onChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const key = select.value as AttributeKey;
    select.value = "";
    if (key && !modelValue.value.includes(key)) {
        modelValue.value = [...modelValue.value, key];
    }
}
</script>

<style scoped>
.attribute-select {
    width: 100%;
}
</style>
