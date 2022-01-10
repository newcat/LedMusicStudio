<template>
    <div ref="el" class="color-picker" @click.self="open = true" :style="{ backgroundColor: modelValue }">
        <transition name="slide-fade">
            <cp-chrome
                class="color-picker-overlay"
                v-show="open"
                :model-value="modelValue"
                @update:model-value="emit('update:modelValue', $event.hex)"
            ></cp-chrome>
        </transition>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
// @ts-ignore
import { Chrome as CpChrome } from "@ckpack/vue-color";
import { onClickOutside } from "@vueuse/core";

defineProps({
    modelValue: { type: String, default: "#000000" },
});

const emit = defineEmits(["update:modelValue"]);

const el = ref<HTMLElement | null>(null);
const open = ref(false);

onClickOutside(el, () => {
    open.value = false;
});
</script>

<style scoped>
.color-picker {
    height: 100%;
    border-radius: 3px;
}

.color-picker-overlay {
    position: absolute;
    left: 100%;
    top: 0%;
    z-index: 100;
}
</style>
