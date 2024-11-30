<template>
    <div class="color-option">
        <div class="__name">{{ intf.name }}</div>
        <div class="__color">
            <color-picker v-model="modelValue"></color-picker>
        </div>
    </div>
</template>

<script setup lang="ts">
import { NodeInterface } from "baklavajs";
import ColorPicker from "./ColorPicker.vue";
import { Color } from "../colors";

const modelValue = defineModel<Color>({ required: true });

defineProps<{
    intf: NodeInterface;
}>();
</script>

<style scoped>
.color-option {
    display: flex;
}
.__name {
    flex-grow: 1;
}

.__color {
    width: 60px;
}
</style>
