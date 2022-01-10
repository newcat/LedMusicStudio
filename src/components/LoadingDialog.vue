<template>
    <n-modal :show="modelValue" @update:show="emit('update:modelValue', $event)" preset="card" title="Loading">
        <template v-for="item in items">
            <div class="my-3" v-if="item.loading || item.error" :key="item.id">
                <div class="d-flex align-items-center">
                    <div class="mr-2">
                        <n-spin v-if="item.loading" size="small" />
                        <n-icon v-else-if="item.error" color="red">
                            <close-filled />
                        </n-icon>
                    </div>
                    <div>
                        <div>{{ item.name }}</div>
                        <n-button
                            v-if="isAudioItem(item) && item.error"
                            @click="item instanceof AudioLibraryItem ? replaceAudioFile(item) : undefined"
                            size="small"
                        >
                            Choose File
                        </n-button>
                    </div>
                </div>
            </div>
        </template>

        <template #action>
            <n-button @click="close">Close</n-button>
        </template>
    </n-modal>
</template>

<script setup lang="ts">
import { BaklavaEvent } from "@baklavajs/events";
import { dialog } from "@electron/remote";
import { computed, watch } from "vue";
import { NModal, NButton, NSpin, NIcon } from "naive-ui";
import { CloseFilled } from "@vicons/material";

import { AudioLibraryItem } from "@/audio";
import { globalState } from "@/globalState";
import { LibraryItem, LibraryItemType } from "@/library";

const token = Symbol();

const props = defineProps({
    modelValue: { type: Boolean },
});

const emit = defineEmits(["update:modelValue"]);

const items = computed<LibraryItem[]>(() => {
    return globalState.library.items.slice().sort((a) => (a.loading ? 0 : 1));
});

function isAudioItem(item: LibraryItem) {
    return item.type === LibraryItemType.AUDIO;
}

async function replaceAudioFile(item: AudioLibraryItem) {
    const dialogResult = await dialog.showOpenDialog({
        title: "Select Audio File",
        filters: [
            { name: "Audio Files", extensions: ["mp3", "wav", "flac", "ogg"] },
            { name: "All Files", extensions: ["*"] },
        ],
    });
    if (dialogResult.canceled) {
        return "";
    }
    item.path = dialogResult.filePaths![0];
    item.load();
}

watch(
    () => props.modelValue,
    () => {
        if (props.modelValue) {
            items.value.forEach((i) => {
                if ((i as any).events?.loaded) {
                    ((i as any).events.loaded as BaklavaEvent<void, unknown>).subscribe(token, () => checkIfLoadingDone());
                }
            });
        }
    }
);

function checkIfLoadingDone() {
    if (items.value.every((i) => !i.loading && !i.error)) {
        close();
    }
}

function close() {
    items.value.forEach((i) => {
        if ((i as any).events?.loaded) {
            ((i as any).events.loaded as BaklavaEvent<void, unknown>).unsubscribe(token);
        }
    });
    emit("update:modelValue", false);
}
</script>
