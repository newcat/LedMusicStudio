<template>
    <Dialog :visible="modelValue" header="Loading" modal @update:visible="emit('update:modelValue', $event)">
        <template v-for="item in items">
            <div v-if="item.loading || item.error" :key="item.id" class="my-3">
                <div class="flex flex-nowrap align-items-center">
                    <div class="mr-2">
                        <i v-if="item.loading" class="pi pi-spin pi-spinner"></i>
                        <i v-else-if="item.error" class="pi pi-times error-icon"></i>
                    </div>
                    <div>
                        <div>{{ item.name }}</div>
                        <Button
                            v-if="isAudioLibraryItem(item) && item.error"
                            size="small"
                            @click="isAudioLibraryItem(item) ? item.chooseAudioFile() : undefined"
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
import { WatchStopHandle, computed, watch } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";

import { LibraryItem, useLibrary } from "@/library";
import { isAudioLibraryItem } from "@/utils";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(["update:modelValue"]);

const library = useLibrary();

const items = computed<LibraryItem[]>(() => {
    return library.items.slice().sort((a) => (a.loading ? 0 : 1));
});

let stopWatch: WatchStopHandle | null = null;
watch(
    () => props.modelValue,
    () => {
        if (props.modelValue) {
            if (stopWatch) {
                stopWatch();
            }

            stopWatch = watch(
                () => items.value,
                () => {
                    if (!library.loading && items.value.every((i) => !i.loading && !i.error)) {
                        close();
                    }
                },
                { deep: true, immediate: true }
            );
        }
    }
);

function close() {
    emit("update:modelValue", false);
    stopWatch?.();
    stopWatch = null;
}
</script>

<style scoped>
.error-icon {
    color: red;
}
</style>
