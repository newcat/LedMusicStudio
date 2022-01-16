<template>
    <div class="color-option">
        <div class="__name">{{ intf.name }}</div>
        <div class="__color">
            <color-picker :model-value="color" @update:model-value="setColor"></color-picker>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NodeInterface } from "@baklavajs/core";
import ColorPicker from "./ColorPicker.vue";
import { fromChroma, Color, chroma, toChroma } from "../colors";

const props = defineProps({
    intf: { type: Object as () => NodeInterface, required: true },
    modelValue: { type: Array as unknown as () => Color, required: true },
});

const emit = defineEmits(["update:modelValue"]);

const color = computed(() => {
    if (!props.modelValue) {
        return "#000000";
    } else {
        return toChroma(props.modelValue).css();
    }
});

function setColor(color: string) {
    emit("update:modelValue", fromChroma(chroma(color)));
}
</script>

<style lang="scss" scoped>
.color-option {
    display: flex;

    & > .__name {
        flex-grow: 1;
    }

    & > .__color {
        width: 60px;
    }
}
</style>
