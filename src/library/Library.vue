<template>
    <n-card class="full-height" title="Library">
        <div class="mb-5">
            <n-dropdown trigger="click" @select="addItem" :options="addItemOptions">
                <n-button>Add Item</n-button>
            </n-dropdown>
        </div>

        <n-tree block-line selectable :data="items" v-model:expanded-keys="expandedKeys" v-model:selected-keys="selectedKeys"></n-tree>

        <input ref="fileinput" type="file" @change="loadAudio" style="display: none" />
        <item-settings v-if="activeItem" v-model="settingsOpen" :item="activeItem"></item-settings>
    </n-card>
</template>

<script setup lang="ts">
import { ref, computed, Ref } from "vue";
import { NCard, NDropdown, DropdownOption, NTree, TreeOption, NButton } from "naive-ui";

import { AudioLibraryItem } from "@/audio/audio.libraryItem";
import { AutomationLibraryItem } from "@/automation/automation.libraryItem";
import { GraphLibraryItem } from "@/graph/graph.libraryItem";
import { PatternLibraryItem } from "@/pattern/pattern.libraryItem";
import { globalState } from "@/globalState";
import { LibraryItemType, LibraryItem } from "./libraryItem";
import ItemSettings from "./LibraryItemSettings.vue";
import { OutputLibraryItem } from "@/output/output.libraryItem";
import { StageLibraryItem } from "@/stage/stage.libraryItem";

const emit = defineEmits(["itemSelected"]);

const settingsOpen = ref(false);
const activeItem = ref<LibraryItem | null>(null) as Ref<LibraryItem | null>;
const fileinput = ref<HTMLInputElement | null>(null);

const expandedKeys = ref(["_folder_af", "_folder_graphs", "_folder_ac", "_folder_np", "_folder_op", "_folder_stages"]);
const selectedKeys = computed<string[]>({
    get() {
        return activeItem.value ? [activeItem.value.id] : [];
    },
    set(v) {
        if (v.length > 0) {
            activeItem.value = globalState.library.getItemById(v[0]) ?? null;
        } else {
            activeItem.value = null;
        }
        emit("itemSelected", activeItem.value);
    },
});

const addItemOptions: DropdownOption[] = [
    { label: "Audio", key: LibraryItemType.AUDIO },
    { label: "Graph", key: LibraryItemType.GRAPH },
    { label: "Automation Clip", key: LibraryItemType.AUTOMATION },
    { label: "Note Pattern", key: LibraryItemType.PATTERN },
    { label: "Output", key: LibraryItemType.OUTPUT },
    { label: "Stage", key: LibraryItemType.STAGE },
];

const items = computed(() => {
    const audioFiles: TreeOption = {
        key: "_folder_af",
        label: "Audio Files",
        children: [],
        type: LibraryItemType.AUDIO,
    };
    const graphs: TreeOption = {
        key: "_folder_graphs",
        label: "Graphs",
        children: [],
        type: LibraryItemType.GRAPH,
    };
    const automationClips: TreeOption = {
        key: "_folder_ac",
        label: "Automation Clips",
        children: [],
        type: LibraryItemType.AUTOMATION,
    };
    const notePatterns: TreeOption = {
        key: "_folder_np",
        label: "Note Patterns",
        children: [],
        type: LibraryItemType.PATTERN,
    };
    const outputs: TreeOption = {
        key: "_folder_op",
        label: "Outputs",
        children: [],
        type: LibraryItemType.OUTPUT,
    };
    const stages: TreeOption = {
        key: "_folder_stages",
        label: "Stages",
        children: [],
        type: LibraryItemType.STAGE,
    };
    const rootItems = [audioFiles, graphs, automationClips, notePatterns, outputs, stages];
    globalState.library.items.forEach((item) => {
        const itemData: TreeOption = {
            key: item.id,
            label: item.name,
            type: item.type,
            loading: item.loading,
            error: item.error,
        };
        const rootItem = rootItems.find((ri) => ri.type === item.type);
        if (rootItem) {
            rootItem.children!.push(itemData);
        } else {
            console.warn("No root item for type", item.type);
        }
    });
    return rootItems;
});

function openFileDialog() {
    fileinput.value!.click();
}

async function loadAudio() {
    const f = fileinput.value!.files;
    if (!f || f.length === 0) {
        return;
    }
    const item = new AudioLibraryItem();
    item.name = f[0].name;
    item.path = f[0].path;
    globalState.library.addItem(item);
    await item.load();
}

function dragstart(ev: DragEvent, itemId: string) {
    ev.dataTransfer!.setData("id", itemId);
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
    globalState.library.addItem(new item());
}

function deleteItem(id: string) {
    globalState.library.removeItem(globalState.library.getItemById(id)!);
}
</script>
