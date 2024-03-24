<template>
    <Dialog :visible="showDialog" :style="{ width: '50vw' }" header="Rendering" modal>
        <ProgressBar class="render-bar" :value="progress" />

        <template #footer>
            <Button @click="cancel">Cancel</Button>
        </template>
    </Dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { pack } from "msgpackr";
import { gzipSync } from "fflate";

import Dialog from "primevue/dialog";
import ProgressBar from "primevue/progressbar";
import Button from "primevue/button";
import { useToast } from "primevue/usetoast";

import { BaseTimelineProcessor } from "@/timeline";
import { useGlobalState } from "@/globalState";
import { TICKS_PER_BEAT } from "@/constants";
import { useStage } from "@/stage";
import { unitToSeconds } from "@/utils";
import { getNativeAdapter } from "@/native";

const globalState = useGlobalState();
const toast = useToast();
const stage = useStage();
const nativeAdapter = getNativeAdapter();

const showDialog = ref(false);
const cancelRequest = ref(false);
const progress = ref(0);

interface RenderResult {
    timestamps: number[];
    fixtureValues: Record<string, unknown[]>;
}

async function startRender() {
    showDialog.value = true;
    const maxUnit = globalState.timeline.items.reduce((max, item) => Math.max(max, item.end), 0);
    const processor = new BaseTimelineProcessor();
    progress.value = 0;
    let nextFrameTime = 0;
    const result: RenderResult = { timestamps: [], fixtureValues: {} };

    stage.visualization.pause();

    for (let unit = 0; unit <= maxUnit; unit++) {
        if (cancelRequest.value) {
            break;
        }
        try {
            await processor.process(unit);
        } catch (err) {
            console.error(err);
            toast.add({ severity: "error", summary: "Rendering Error", detail: err instanceof Error ? err.message : String(err) });
            cancelRequest.value = true;
            break;
        }

        const secondsPerFrame = 1 / globalState.fps;
        const nextTimestamp = unitToSeconds(unit + 1, globalState.bpm);
        if (nextTimestamp > nextFrameTime) {
            result.timestamps.push(nextFrameTime);
            nextFrameTime += secondsPerFrame;
            for (const [fixtureId, fixture] of stage.fixtures.entries()) {
                if (!result.fixtureValues[fixtureId]) {
                    result.fixtureValues[fixtureId] = [];
                }
                result.fixtureValues[fixtureId].push(fixture.value);
            }
        }

        progress.value = Math.floor((unit / maxUnit) * 100);
        if (unit % TICKS_PER_BEAT === 0) {
            await new Promise((res) => setTimeout(res, 0));
        }
    }

    progress.value = 100;
    stage.visualization.resume();

    if (cancelRequest.value) {
        cancelRequest.value = false;
        showDialog.value = false;
        return;
    }

    const data = gzipSync(pack(result));
    await nativeAdapter.chooseAndWriteFile(data, {
        suggestedName: "render.lmr",
        accept: [
            {
                name: "LedMusicStudio Render File",
                extensions: ["lmr"],
            },
        ],
    });
    showDialog.value = false;
}

function cancel() {
    cancelRequest.value = true;
}

defineExpose({ startRender });
</script>

<style scoped>
.render-bar :deep(.p-progressbar-value-animate) {
    transition: none;
}
</style>
