<template>
    <div class="note" :class="{ '--selected': note.selected }" :style="styles" @mousedown.self="dragStart">
        <div class="__resizeHandle" @mousedown.self="resizeStart"></div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { INote } from "./types";

const props = defineProps({
    note: { type: Object as () => INote, required: true },
    tickWidth: { type: Number, required: true },
});

const emit = defineEmits(["dragStart", "resizeStart"]);

const styles = computed(() => ({
    transform: `translateX(${props.note.start * props.tickWidth}px)`,
    width: `${(props.note.end - props.note.start) * props.tickWidth}px`,
}));

function dragStart(ev: MouseEvent) {
    emit("dragStart", ev.offsetX);
}

function resizeStart(ev: MouseEvent) {
    emit("resizeStart", ev.offsetX);
}
</script>

<style scoped>
.note {
    position: absolute;
    height: calc(100% - 2px);
    top: 1px;
    background-color: #1eb980;
    border: 1px solid lighten(#1eb980, 20%);
    border-radius: 3px;
    transition: border 0.1s;
}

.note:hover {
    border-color: #fff;
}

.note.--selected {
    border: 2px solid #fff;
}

.__resizeHandle {
    position: absolute;
    right: 0;
    width: 8px;
    height: 100%;
    cursor: col-resize;
}
</style>
