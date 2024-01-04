<template>
    <div class="library">
        <Toolbar>
            <template #start>
                <div class="font-bold text-xl">Library</div>
            </template>
            <template #end>
                <Button type="button" outlined size="small" @click="toggleAddItemMenu">Add Item</Button>
                <Menu ref="menu" :model="addItemOptions" :popup="true"></Menu>
            </template>
        </Toolbar>
        <Card class="menu-container">
            <template #content>
                <Listbox
                    :options="libraryItems"
                    v-model="library.selectedItemId"
                    optionLabel="label"
                    optionValue="key"
                    optionDisabled="loading"
                    optionGroupLabel="label"
                    optionGroupChildren="items"
                >
                    <template #optiongroup="{ option }">
                        <i :class="option.icon"></i>
                        {{ option.label }}
                    </template>
                    <template #option="{ option }">
                        <LibraryItemView :item-id="option.key" />
                    </template>
                </Listbox>

                <input ref="fileinput" type="file" @change="loadAudio" style="display: none" />
            </template>
        </Card>
        <SelectOutputTypeDialog v-model="showSelectOutputTypeDialog" @create-output="addOutput" />
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import Toolbar from "primevue/toolbar";
import Button from "primevue/button";
import Menu, { MenuProps } from "primevue/menu";
import Card from "primevue/card";
import Listbox, { ListboxProps } from "primevue/listbox";

import { AudioLibraryItem } from "@/audio/audio.libraryItem";
import { AutomationLibraryItem } from "@/automation/automation.libraryItem";
import { GraphLibraryItem } from "@/graph/graph.libraryItem";
import { PatternLibraryItem } from "@/pattern/pattern.libraryItem";
import { LibraryItemType, LibraryItem, LibraryItemTypeIcons, LibraryItemTypeLabels, LibraryItemTypeList } from "./libraryItem";
import { useLibrary } from "./libraryModel";

import LibraryItemView from "./LibraryItem.vue";
import SelectOutputTypeDialog from "@/output/SelectOutputTypeDialog.vue";

const library = useLibrary();

const fileinput = ref<HTMLInputElement | null>(null);
const menu = ref<Menu | null>(null);
const showSelectOutputTypeDialog = ref(false);

const getMenuItem = (type: LibraryItemType) => ({
    label: LibraryItemTypeLabels[type],
    icon: `mdi mdi-${LibraryItemTypeIcons[type]}`,
    command: () => addItem(type),
});
const addItemOptions: MenuProps["model"] = LibraryItemTypeList.map((type) => getMenuItem(type));

const libraryItems = computed<ListboxProps["options"]>(() => {
    return LibraryItemTypeList.map((type) => ({
        key: `LIT_${type}`,
        label: LibraryItemTypeLabels[type],
        icon: `mdi mdi-${LibraryItemTypeIcons[type]}`,
        items: library.items
            .filter((it) => it.type === type)
            .map((it) => ({
                key: it.id,
                loading: it.loading,
            })),
    }));
});

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
    library.addItem(item);
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
        case LibraryItemType.PATTERN:
            item = PatternLibraryItem;
            break;
        default:
            return;
    }
    library.addItem(reactive(new item()));
}

function addOutput(output: LibraryItem) {
    library.addItem(reactive(output));
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
