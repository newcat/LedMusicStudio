<template>
    <Dialog :visible="showDialog" :style="{ width: '50vw' }" header="Rendering" modal>
        <ProgressBar :value="progress" />

        <template #footer>
            <Button @click="cancel">Cancel</Button>
        </template>
    </Dialog>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import Dialog from "primevue/dialog";
import ProgressBar from "primevue/progressbar";
import Button from "primevue/button";
import { useToast } from "primevue/usetoast";

import { BaseTimelineProcessor } from "@/timeline";
import { useGlobalState } from "@/globalState";
import { TICKS_PER_BEAT } from "@/constants";

const globalState = useGlobalState();
const toast = useToast();

const showDialog = ref(false);
const cancelRequest = ref(false);
const progress = ref(0);

async function startRender() {
    showDialog.value = true;
    const maxUnit = globalState.timeline.items.reduce((max, item) => Math.max(max, item.end), 0);
    const processor = new BaseTimelineProcessor();
    progress.value = 0;
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
        progress.value = Math.floor((unit / maxUnit) * 100);
        if (unit % TICKS_PER_BEAT === 0) {
            await nextTick();
            await new Promise((res) => requestAnimationFrame(res));
        }
    }

    if (cancelRequest.value) {
        cancelRequest.value = false;
        showDialog.value = false;
        return;
    }

    showDialog.value = false;
}

function cancel() {
    cancelRequest.value = true;
}

defineExpose({ startRender });
</script>
