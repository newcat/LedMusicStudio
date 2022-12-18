<template>
    <div class="library">
        <Toolbar>
            <template #start>Library</template>
            <template #end>
                <Button class="p-button-outlined p-button-sm" type="button" @click="toggleAddItemMenu">Add Item</Button>
                <Menu ref="menu" id="overlay_menu" :model="addItemOptions" :popup="true">
                    <!--<template #item="{ item }">
                    <a @click="item.command">
                        <Icon></Icon>
                        {{ item.label }}
                    </a>
                </template>-->
                </Menu>
            </template>
        </Toolbar>
        <Card class="menu-container">
            <template #content>
                <PanelMenu :model="libraryItems" />

                <input ref="fileinput" type="file" @change="loadAudio" style="display: none" />
                <!-- TODO <item-settings v-if="activeItem" v-model="settingsOpen" :item="activeItem"></item-settings> -->
            </template>
        </Card>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, Ref, watch } from "vue";
import Toolbar from "primevue/toolbar";
import Button from "primevue/button";
import Menu, { MenuProps } from "primevue/menu";
import Card from "primevue/card";
import PanelMenu, { PanelMenuProps } from "primevue/panelmenu";

import { AudioLibraryItem } from "@/audio/audio.libraryItem";
import { AutomationLibraryItem } from "@/automation/automation.libraryItem";
import { GraphLibraryItem } from "@/graph/graph.libraryItem";
import { PatternLibraryItem } from "@/pattern/pattern.libraryItem";
import { globalState } from "@/globalState";
import { OutputLibraryItem } from "@/output/output.libraryItem";
import { StageLibraryItem } from "@/stage/stage.libraryItem";
import { LibraryItemType, LibraryItem, LibraryItemTypeIcons, LibraryItemTypeLabels, LibraryItemTypeList } from "./libraryItem";

import LibraryCategory from "./LibraryCategory.vue";
import ItemSettings from "./LibraryItemSettings.vue";

const settingsOpen = ref(false);
const fileinput = ref<HTMLInputElement | null>(null);
const menu = ref<Menu | null>(null);

const getMenuItem = (type: LibraryItemType) => ({
    label: LibraryItemTypeLabels[type],
    icon: `mdi mdi-${LibraryItemTypeIcons[type]}`,
    command: () => addItem(type),
});
const addItemOptions: MenuProps["model"] = LibraryItemTypeList.map((type) => getMenuItem(type));

// TODO: Why doesn't reactivity work here?
const libraryItems = computed<PanelMenuProps["model"]>(() =>
    LibraryItemTypeList.map((type) => ({
        label: LibraryItemTypeLabels[type],
        icon: LibraryItemTypeIcons[type],
        items: globalState.library.items
            .filter((it) => it.type === type)
            .map((it) => ({
                label: it.name,
                icon: it.loading ? "pi pi-spinner" : `mdi mdi-${LibraryItemTypeIcons[it.type]}`,
                disabled: it.loading,
            })),
    }))
);

watch(
    () => globalState.library.items,
    () => {
        console.log("W", libraryItems);
    }
);

function openFileDialog() {
    fileinput.value!.click();
}

function toggleAddItemMenu(ev: Event) {
    menu.value!.toggle(ev);
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
    console.log(globalState.library.items);
}

function deleteItem(id: string) {
    globalState.library.removeItem(globalState.library.getItemById(id)!);
}
</script>

<style scoped>
.library {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.menu-container {
    width: 100%;
    flex-grow: 1;
}

.menu-container :deep(.p-card-body) {
    padding: 0;
}

.menu-container :deep(.p-card-content) {
    padding: 0;
}
</style>
