<template lang="pug">
v-dialog(:value="value", @input="$emit('input', $event)" max-width="400")
    v-card
        v-card-title
            .headline Loading
        
        v-card-text
            
            template(v-for="item in items")
                .my-3(v-if="item.loading || item.error", :key="item.id")
                    .d-flex.align-items-center
                        .mr-2
                            v-progress-circular(v-if="item.loading", indeterminate, color="green", :size="25", :width="2")
                            v-icon(v-else-if="item.error", color="red") close
                        div
                            div {{ item.name }}
                            v-btn(v-if="isAudioItem(item) && item.error", @click="replaceAudioFile(item)", x-small, outlined) Choose File

        v-card-actions
            v-spacer
            v-btn(text, @click="close") Close
</template>

<script lang="ts">
import type { AudioLibraryItem } from "@/audio";

import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import { remote } from "electron";
import { BaklavaEvent } from "@baklavajs/events";
import { globalState } from "@/globalState";
import { LibraryItem, LibraryItemType } from "@/library";

@Component
export default class LoadingDialog extends Vue {
    @Prop({ type: Boolean, required: true })
    public value!: boolean;

    private gs = globalState;

    get items() {
        return this.gs.library.items.slice().sort((a) => (a.loading ? 0 : 1));
    }

    isAudioItem(item: LibraryItem) {
        return item.type === LibraryItemType.AUDIO;
    }

    async replaceAudioFile(item: AudioLibraryItem) {
        const dialogResult = await remote.dialog.showOpenDialog({
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

    @Watch("value")
    subscribeLoadedEvents() {
        if (this.value) {
            this.items.forEach((i) => {
                if ((i as any).events?.loaded) {
                    ((i as any).events.loaded as BaklavaEvent<void>).addListener(this, () => this.checkIfLoadingDone());
                }
            });
        }
    }

    /*@Watch("items", { deep: true })*/
    checkIfLoadingDone() {
        if (this.items.every((i) => !i.loading && !i.error)) {
            this.close();
        }
    }

    close() {
        this.items.forEach((i) => {
            if ((i as any).events?.loaded) {
                ((i as any).events.loaded as BaklavaEvent<void>).removeListener(this);
            }
        });
        this.$emit("input", false);
    }
}
</script>
