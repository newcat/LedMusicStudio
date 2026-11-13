<template>
    <div class="view-hud">
        <div v-if="showFps && stats" class="hud-line fps">{{ stats.fps.toFixed(0) }} fps · {{ stats.frameMs.toFixed(1) }} ms</div>
        <div v-for="notice in notices" :key="notice.feature" class="hud-line notice" role="status">
            <span>{{ notice.message }}</span>
            <button type="button" class="notice-close" aria-label="Close notice" @click="dismiss(notice.feature)">×</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from "vue";

import type { FrameStats, SceneView } from "./sceneView";
import type { FallbackNotice } from "./quality";

const props = defineProps<{
    view: SceneView;
    showFps: boolean;
}>();

/** Auto-hide delay of a fallback notice (contracts/rendering-ui.md). */
const NOTICE_MS = 8000;

const stats = shallowRef<FrameStats | null>(null);
const notices = shallowRef<FallbackNotice[]>([]);
/** Features already shown in this view; a notice is shown once, even after it was closed or hidden. */
const seenFeatures = new Set<FallbackNotice["feature"]>();
const hideTimers = new Map<FallbackNotice["feature"], ReturnType<typeof setTimeout>>();

function addNotice(notice: FallbackNotice) {
    if (seenFeatures.has(notice.feature)) {
        return;
    }
    seenFeatures.add(notice.feature);
    notices.value = [...notices.value, notice];
    hideTimers.set(
        notice.feature,
        setTimeout(() => dismiss(notice.feature), NOTICE_MS),
    );
}

function dismiss(feature: FallbackNotice["feature"]) {
    clearTimeout(hideTimers.get(feature));
    hideTimers.delete(feature);
    notices.value = notices.value.filter((n) => n.feature !== feature);
}

function clearNotices() {
    for (const timer of hideTimers.values()) {
        clearTimeout(timer);
    }
    hideTimers.clear();
    seenFeatures.clear();
    notices.value = [];
}

let stopNotices: (() => void) | undefined;
let stopStats: (() => void) | undefined;

// notices: onNotice replays the notices already reported by the view, so a new subscription starts complete
watch(
    () => props.view,
    (view) => {
        stopNotices?.();
        clearNotices();
        stopNotices = view.onNotice(addNotice);
    },
    { immediate: true },
);

// frame rate: only subscribed while the overlay is shown
watch(
    [() => props.view, () => props.showFps],
    ([view, showFps]) => {
        stopStats?.();
        stopStats = undefined;
        stats.value = null;
        if (showFps) {
            stopStats = view.onFrameStats((next) => {
                stats.value = next;
            });
        }
    },
    { immediate: true },
);

onBeforeUnmount(() => {
    stopStats?.();
    stopNotices?.();
    clearNotices();
});
</script>

<style scoped>
.view-hud {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
    max-width: 28rem;
    pointer-events: none;
    z-index: 1;
}

.hud-line {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    font-size: 0.8rem;
}

.fps {
    font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
    white-space: nowrap;
}

.notice {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
}

.notice-close {
    pointer-events: auto;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0;
}
</style>
