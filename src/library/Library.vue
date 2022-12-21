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
                <PanelMenu :model="libraryItems" v-model:expanded-keys="expandedKeys">
                    <!--<template #item="{ item }">
                        <a class="p-menuitem-link" :tabindex="-1">
                            <span
                                v-if="item.items && item.key"
                                class="p-submenu-icon"
                                :class="[expandedKeys[item.key] ? 'pi pi-chevron-down' : 'pi pi-chevron-right']"
                            ></span>
                            <span class="p-menuitem-icon" :class="item.icon"></span>
                            <span class="p-menuitem-text">{{ item.label }}</span>
                        </a>
                    </template>-->
                </PanelMenu>

                <input ref="fileinput" type="file" @change="loadAudio" style="display: none" />
                <!-- TODO <item-settings v-if="activeItem" v-model="settingsOpen" :item="activeItem"></item-settings> -->
            </template>
        </Card>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, Ref, toRef, watch } from "vue";
import Toolbar from "primevue/toolbar";
import Button from "primevue/button";
import Menu, { MenuProps } from "primevue/menu";
import Card from "primevue/card";
import PanelMenu, { PanelMenuProps } from "primevue/panelmenu";

import { AudioLibraryItem } from "@/audio/audio.libraryItem";
import { AutomationLibraryItem } from "@/automation/automation.libraryItem";
import { GraphLibraryItem } from "@/graph/graph.libraryItem";
import { PatternLibraryItem } from "@/pattern/pattern.libraryItem";
import { OutputLibraryItem } from "@/output/output.libraryItem";
import { StageLibraryItem } from "@/stage/stage.libraryItem";
import { LibraryItemType, LibraryItem, LibraryItemTypeIcons, LibraryItemTypeLabels, LibraryItemTypeList } from "./libraryItem";
import { useLibrary } from "./libraryModel";

// import ItemSettings from "./LibraryItemSettings.vue";

const library = useLibrary();

const settingsOpen = ref(false);
const fileinput = ref<HTMLInputElement | null>(null);
const menu = ref<Menu | null>(null);
const expandedKeys = ref<Record<string, unknown>>({});

const getMenuItem = (type: LibraryItemType) => ({
    label: LibraryItemTypeLabels[type],
    icon: `mdi mdi-${LibraryItemTypeIcons[type]}`,
    command: () => addItem(type),
});
const addItemOptions: MenuProps["model"] = LibraryItemTypeList.map((type) => getMenuItem(type));

// TODO: Why doesn't reactivity work here?
const libraryItems = computed<PanelMenuProps["model"]>(() => {
    return LibraryItemTypeList.map((type) => ({
        key: `LIT_${type}`,
        label: LibraryItemTypeLabels[type],
        icon: LibraryItemTypeIcons[type],
        items: library.items
            .filter((it) => it.type === type)
            .map((it) => ({
                key: it.id,
                label: it.name,
                icon: it.loading ? "pi pi-spinner" : `mdi mdi-${LibraryItemTypeIcons[it.type]}`,
                disabled: it.loading,
                command: () => {
                    library.selectedItemId = it.id;
                },
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
    library.addItem(reactive(new item()));
}

function deleteItem(id: string) {
    library.removeItem(library.getItemById(id)!);
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
