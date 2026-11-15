<template>
    <span
        class="clip-target-chip"
        :class="{ '--inherit': target === 'inherit', '--none': !effective }"
        @mousedown.stop
        @click.stop="toggle"
        @dblclick.stop
    >
        <span v-if="effective" class="__dot" :style="{ background: color ?? undefined }"></span>
        <i v-else class="mdi mdi-alert __warn"></i>
        <span class="__label">{{ label }}</span>
        <span v-if="target === 'inherit'" class="__suffix">· track</span>
        <Popover v-if="popoverMounted" ref="popover" @hide="popoverMounted = false">
            <TargetPicker :model-value="target" :allow-inherit="allowInherit" @update:model-value="pick" @close="popover?.hide()" />
        </Popover>
    </span>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import Popover from "primevue/popover";
import TargetPicker from "@/programming/components/TargetPicker.vue";
import type { TargetSelectValue } from "@/programming/components/TargetSelect.vue";
import { targetLabel } from "@/programming/targets";
import { targetColor } from "@/programming/targetColors";
import type { Target } from "@/programming/types";
import type { ClipTarget } from "../model/item";

/** Target chip of clips and track headers (feature 005, R12): dot + label, click opens a filterable picker. */
const props = withDefaults(defineProps<{ target: ClipTarget; effective: Target | null; allowInherit?: boolean }>(), { allowInherit: true });

const emit = defineEmits<{ "update:target": [value: ClipTarget] }>();

const popover = ref<InstanceType<typeof Popover>>();
/** Mounted on demand: every clip has a chip. */
const popoverMounted = ref(false);

const label = computed(() => targetLabel(props.effective));
const color = computed(() => targetColor(props.effective));

function toggle(ev: MouseEvent) {
    if (popoverMounted.value) {
        popover.value?.hide();
        return;
    }
    popoverMounted.value = true;
    const target = ev.currentTarget as HTMLElement;
    void nextTick(() => popover.value?.show(ev, target));
}

function pick(value: TargetSelectValue) {
    if (value === "clip") {
        return;
    }
    if (value === "inherit" && !props.allowInherit) {
        return;
    }
    emit("update:target", value && value !== "inherit" ? { ...value } : value);
}
</script>

<style scoped>
.clip-target-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    max-width: 100%;
    padding: 0 0.35rem;
    height: 1.1rem;
    border-radius: 0.55rem;
    background: rgba(0, 0, 0, 0.45);
    color: var(--p-text-color);
    font-size: 0.68rem;
    line-height: 1;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    flex: none;
}
.clip-target-chip:hover {
    background: rgba(0, 0, 0, 0.65);
}
.clip-target-chip.--inherit {
    opacity: 0.75;
    font-style: italic;
}
.clip-target-chip.--none {
    color: var(--p-yellow-400, #facc15);
}
.__dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    flex: none;
}
.__warn {
    font-size: 0.75rem;
}
.__label {
    overflow: hidden;
    text-overflow: ellipsis;
}
.__suffix {
    opacity: 0.8;
}
</style>
