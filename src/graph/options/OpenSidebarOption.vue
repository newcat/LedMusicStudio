<template>
    <button class="baklava-button --block" :title="intf.name" @click="onClick">
        {{ intf.name }}
    </button>
</template>

<script setup lang="ts">
import { NodeInterface } from "baklavajs";

defineProps<{
    intf: NodeInterface;
}>();

const emit = defineEmits(["openSidebar"]);

function onClick() {
    emit("openSidebar");
}
</script>
