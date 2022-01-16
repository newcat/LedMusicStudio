<template>
    <n-card class="full-height" title="Library">
        <div class="mb-5">
            <n-dropdown trigger="click" @select="addItem" :options="addItemOptions">
                <n-button>Add Item</n-button>
            </n-dropdown>
        </div>

        <library-category :type="LibraryItemType.AUDIO" name="Audio" />
        <n-divider class="my-1" />
        <library-category :type="LibraryItemType.GRAPH" name="Graph" />
        <n-divider class="my-1" />
        <library-category :type="LibraryItemType.AUTOMATION" name="Automation Clip" />
        <n-divider class="my-1" />
        <library-category :type="LibraryItemType.PATTERN" name="Note Pattern" />
        <n-divider class="my-1" />
        <library-category :type="LibraryItemType.OUTPUT" name="Output" />
        <n-divider class="my-1" />
        <library-category :type="LibraryItemType.STAGE" name="Stage" />

        <input ref="fileinput" type="file" @change="loadAudio" style="display: none" />
        <!-- TODO <item-settings v-if="activeItem" v-model="settingsOpen" :item="activeItem"></item-settings> -->
    </n-card>
</template>

<script setup lang="ts">
import { reactive, ref, Ref } from "vue";
import { NCard, NDropdown, DropdownOption, NButton, NDivider } from "naive-ui";

import { AudioLibraryItem } from "@/audio/audio.libraryItem";
import { AutomationLibraryItem } from "@/automation/automation.libraryItem";
import { GraphLibraryItem } from "@/graph/graph.libraryItem";
import { PatternLibraryItem } from "@/pattern/pattern.libraryItem";
import { globalState } from "@/globalState";
import { OutputLibraryItem } from "@/output/output.libraryItem";
import { StageLibraryItem } from "@/stage/stage.libraryItem";
import { LibraryItemType, LibraryItem } from "./libraryItem";

import LibraryCategory from "./LibraryCategory.vue";
import ItemSettings from "./LibraryItemSettings.vue";

const settingsOpen = ref(false);
const fileinput = ref<HTMLInputElement | null>(null);

const addItemOptions: DropdownOption[] = [
    { label: "Audio", key: LibraryItemType.AUDIO },
    { label: "Graph", key: LibraryItemType.GRAPH },
    { label: "Automation Clip", key: LibraryItemType.AUTOMATION },
    { label: "Note Pattern", key: LibraryItemType.PATTERN },
    { label: "Output", key: LibraryItemType.OUTPUT },
    { label: "Stage", key: LibraryItemType.STAGE },
];

function openFileDialog() {
    fileinput.value!.click();
}

async function loadAudio() {
    const f = fileinput.value!.files;
    if (!f || f.length === 0) {
        return;
    }
    const item = reactive(new AudioLibraryItem());
    item.name = f[0].name;
    item.path = f[0].path;
    globalState.library.addItem(item);
    await item.load();
}

function getIcon(type: LibraryItemType) {
    switch (type) {
        case LibraryItemType.AUDIO:
            return "library_music";
        case LibraryItemType.GRAPH:
            return "device_hub";
        case LibraryItemType.AUTOMATION:
            return "timeline";
        case LibraryItemType.PATTERN:
            return "queue_music";
        case LibraryItemType.OUTPUT:
            return "mediation";
        case LibraryItemType.STAGE:
            return "airplay";
        default:
            return "note";
    }
}

function addItem(key: LibraryItemType) {
    let item: new () => LibraryItem;
    switch (key) {
        case LibraryItemType.AUDIO:
            openFileDialog();
            return;
        case LibraryItemType.AUTOMATION:
            item = AutomationLibraryItem;
            break;
        case LibraryItemType.GRAPH:
            item = GraphLibraryItem;
            break;
        case LibraryItemType.OUTPUT:
            item = OutputLibraryItem;
            break;
        case LibraryItemType.PATTERN:
            item = PatternLibraryItem;
            break;
        case LibraryItemType.STAGE:
            item = StageLibraryItem;
            break;
        default:
            return;
    }
    globalState.library.addItem(reactive(new item()));
}

function deleteItem(id: string) {
    globalState.library.removeItem(globalState.library.getItemById(id)!);
}
</script>
