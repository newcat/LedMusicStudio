<template>
    <div class="position-marker" :style="styles"></div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { globalState } from "@/globalState";
import { TimelineEditor } from "../model";

const props = defineProps({
    editor: { type: Object as () => TimelineEditor, required: true },
});

const styles = computed(() => ({
    transform: `translateX(${globalState.position * props.editor.unitWidth + props.editor.headerWidth}px)`,
}));
</script>
