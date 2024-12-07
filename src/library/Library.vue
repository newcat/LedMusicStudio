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
        <Card class="menu-container" :pt="{ body: { class: 'h-full' }, content: { class: 'h-full' } }">
            <template #content>
                <div class="items-container">
                    <template v-for="type in LibraryItemTypeList" :key="type">
                        <h3 class="m-0">
                            <i :class="`mdi mdi-${LibraryItemTypeIcons[type]}`" />
                            {{ LibraryItemTypeLabels[type] }}
                        </h3>
                        <div>
                            <LibraryItemView v-for="item in getLibraryItemsByType(type)" :key="item.id" :item-id="item.id" />
                        </div>
                        <hr class="w-full" />
                    </template>
                </div>
            </template>
        </Card>
    </div>
</template>

<script setup lang="ts">
import { reactive, ref, ComponentInstance } from "vue";
import Toolbar from "primevue/toolbar";
import Button from "primevue/button";
import Menu, { MenuProps } from "primevue/menu";
import Card from "primevue/card";

import { useLibrary } from "./libraryModel";

import { AudioLibraryItem } from "@/audio/audio.libraryItem";
import { AutomationLibraryItem } from "@/automation/automation.libraryItem";
import { GraphLibraryItem } from "@/graph/graph.libraryItem";
import { PatternLibraryItem } from "@/pattern/pattern.libraryItem";
import { ScriptLibraryItem } from "@/scripting/script.libraryItem";
import { LibraryItemType, LibraryItem, LibraryItemTypeIcons, LibraryItemTypeLabels, LibraryItemTypeList } from "./libraryItem";

import LibraryItemView from "./LibraryItem.vue";

const library = useLibrary();

const menu = ref<ComponentInstance<typeof Menu> | null>(null);

const getMenuItem = (type: LibraryItemType) => ({
    label: LibraryItemTypeLabels[type],
    icon: `mdi mdi-${LibraryItemTypeIcons[type]}`,
    command: () => addItem(type),
});
const addItemOptions: MenuProps["model"] = LibraryItemTypeList.map((type) => getMenuItem(type));

function toggleAddItemMenu(ev: Event) {
    menu.value!.toggle(ev);
}

function getLibraryItemsByType(type: LibraryItemType) {
    return library.items.filter((it) => it.type === type);
}

async function loadAudio() {
    const item = reactive(new AudioLibraryItem());
    library.addItem(item);
    const result = await item.chooseAudioFile();
    if (!result) {
        await library.removeItem(item);
    }
}

async function addItem(key: LibraryItemType) {
    let item: new () => LibraryItem;
    switch (key) {
        case LibraryItemType.AUDIO:
            await loadAudio();
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
        case LibraryItemType.SCRIPT:
            item = ScriptLibraryItem;
            break;
        default:
            return;
    }
    library.addItem(reactive(new item()));
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

.items-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
</style>
