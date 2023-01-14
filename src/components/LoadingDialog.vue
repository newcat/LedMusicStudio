<template>
    <Dialog :visible="modelValue" @update:visible="emit('update:modelValue', $event)" header="Loading" modal>
        <template v-for="item in items">
            <div class="my-3" v-if="item.loading || item.error" :key="item.id">
                <div class="flex flex-nowrap align-items-center">
                    <div class="mr-2">
                        <i v-if="item.loading" class="pi pi-spin pi-spinner"></i>
                        <i v-else-if="item.error" class="pi pi-times error-icon"></i>
                    </div>
                    <div>
                        <div>{{ item.name }}</div>
                        <Button
                            v-if="isAudioItem(item) && item.error"
                            @click="item instanceof AudioLibraryItem ? replaceAudioFile(item) : undefined"
                            size="small"
                        >
                            Choose File
                        </Button>
                    </div>
                </div>
            </div>
        </template>

        <template #footer>
            <Button @click="close">Close</Button>
        </template>
    </Dialog>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";

import { showOpenDialog } from "@/native";
import { AudioLibraryItem } from "@/audio";
import { LibraryItem, LibraryItemType, useLibrary } from "@/library";

defineProps({
    modelValue: { type: Boolean },
});

const emit = defineEmits(["update:modelValue"]);

const library = useLibrary();

const items = computed<LibraryItem[]>(() => {
    return library.items.slice().sort((a) => (a.loading ? 0 : 1));
});

function isAudioItem(item: LibraryItem) {
    return item.type === LibraryItemType.AUDIO;
}

async function replaceAudioFile(item: AudioLibraryItem) {
    const dialogResult = await showOpenDialog({
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
    () => items.value,
    () => {
        if (items.value.every((i) => !i.loading && !i.error)) {
            close();
        }
    },
    { deep: true, immediate: true }
);

function close() {
    emit("update:modelValue", false);
}
</script>

<style scoped>
.error-icon {
    color: red;
}
</style>
