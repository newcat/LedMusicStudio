<template>
    <div ref="el" class="color-picker" :style="{ backgroundColor: hexColor }" @click.self="open = true">
        <transition name="slide-fade">
            <cp-chrome
                v-show="open"
                :model-value="hexColor"
                class="color-picker-overlay"
                :disable-alpha="true"
                @update:model-value="setColor"
            ></cp-chrome>
        </transition>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Chrome as CpChrome, Payload } from "@ckpack/vue-color";
import { onClickOutside } from "@vueuse/core";
import { Color, toChroma } from "../colors";

const modelValue = defineModel<Color>({ default: [0, 0, 0] });

const el = ref<HTMLElement | null>(null);
const open = ref(false);

const hexColor = computed(() => (modelValue.value ? toChroma(modelValue.value).css() : "#000000"));

function setColor(color: Payload) {
    modelValue.value = [color.rgba.r as number, color.rgba.g as number, color.rgba.b as number];
}

onClickOutside(el, () => {
    open.value = false;
});
</script>

<style scoped>
.color-picker {
    height: 100%;
    border-radius: 3px;
    cursor: pointer;
}

.color-picker-overlay {
    position: absolute;
    left: 100%;
    top: 0%;
    z-index: 100;
    transform: scale(1);
}

:deep(.vc-input__input) {
    background-color: white;
}
</style>
