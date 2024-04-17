<template>
    <Dialog :visible="showDialog" :style="{ width: '50vw' }" header="Rendering" modal>
        <p>{{ step }}</p>
        <ProgressBar class="render-bar" :mode="progress < 0 ? 'indeterminate' : 'determinate'" :value="progress" />

        <template #footer>
            <Button @click="cancel">Cancel</Button>
        </template>
    </Dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";

import Dialog from "primevue/dialog";
import ProgressBar from "primevue/progressbar";
import Button from "primevue/button";
import { useToast } from "primevue/usetoast";

import { useStage } from "@/stage";
import { getNativeAdapter } from "@/native";
import type { Renderer } from "@/renderer";

const toast = useToast();
const stage = useStage();
const nativeAdapter = getNativeAdapter();

const showDialog = ref(false);
const step = ref("");
const progress = ref(0);

let renderer: Renderer | null = null;

async function startRender() {
    const token = Symbol();
    progress.value = 0;
    showDialog.value = true;
    stage.visualization.pause();

    const { Renderer } = await import("@/renderer");
    renderer = new Renderer();
    renderer.events.stepChanged.subscribe(token, (value) => {
        step.value = value;
    });
    renderer.events.progress.subscribe(token, (value) => {
        progress.value = value;
    });

    let result: Uint8Array | null = null;
    try {
        result = await renderer.startRender();
    } catch (err) {
        console.error(err);
        toast.add({ severity: "error", summary: "Rendering Error", detail: err instanceof Error ? err.message : String(err) });
    }

    showDialog.value = false;
    stage.visualization.resume();
    renderer.events.stepChanged.unsubscribe(token);
    renderer.events.progress.unsubscribe(token);
    renderer = null;

    if (result === null) {
        return;
    }

    await nativeAdapter.chooseAndWriteFile(result, {
        suggestedName: "render.lmr",
        accept: [
            {
                name: "LedMusicStudio Render File",
                extensions: ["lmr"],
            },
        ],
    });
}

function cancel() {
    renderer?.cancelRender();
}

defineExpose({ startRender });
</script>

<style scoped>
.render-bar :deep(.p-progressbar-value-animate) {
    transition: none;
}
</style>
