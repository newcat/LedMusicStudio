<template lang="pug">
v-card(flat)
    v-toolbar(dense, flat)
        v-toolbar-title Library
        v-spacer
        v-menu(bottom, left)
            template(v-slot:activator="{ on }")
                v-btn(icon, v-on="on")
                    v-icon add
            v-list
                v-list-item(@click="openFileDialog")
                    v-list-item-title Audio
                v-list-item(@click="addGraph")
                    v-list-item-title Graph
                v-list-item(@click="addAutomationClip")
                    v-list-item-title Automation Clip
                v-list-item(@click="addNotePattern")
                    v-list-item-title Note Pattern
                v-list-item(@click="addOutput")
                    v-list-item-title Output
                v-list-item(@click="addStage")
                    v-list-item-title Stage

    v-treeview(
        :active="!!activeItem ? [activeItem.id] : []",
        :items="items",
        @update:active="onActiveItemChanged"
        open-all,
        open-on-click,
        activatable)

        template(v-slot:prepend="{ item }")
            v-progress-circular(v-if="item.loading", :size="24", :width="2" indeterminate, color="primary")
            v-icon(v-else-if="item.error") warning
            v-icon(v-else) {{ getIcon(item.type) }}

        template(v-slot:label="{ item }")
            .v-treeview-node__label(
                :draggable="!item.id.startsWith('_folder')",
                @dragstart="dragstart($event, item.id)")
                    | {{ item.name }}

        template(v-slot:append="{ item }")
            div(v-if="activeItem && activeItem.id === item.id")
                v-btn(icon, @click.stop="settingsOpen = true")
                    v-icon edit
                v-btn(icon, @click.stop="deleteItem(item.id)")
                    v-icon delete

    input(ref="fileinput", type="file", @change="loadAudio", style="display: none;")
    item-settings(v-model="settingsOpen", :item="activeItem")
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { AudioLibraryItem } from "@/audio/audio.libraryItem";
import { AutomationLibraryItem } from "@/automation/automation.libraryItem";
import { GraphLibraryItem } from "@/graph/graph.libraryItem";
import { PatternLibraryItem } from "@/pattern/pattern.libraryItem";
import { globalState } from "@/globalState";
import { LibraryItemType, LibraryItem } from "./libraryItem";
import ItemSettings from "./LibraryItemSettings.vue";
import { OutputLibraryItem } from "@/output/output.libraryItem";
import { StageLibraryItem } from "@/stage/stage.libraryItem";

interface ITreeNode {
    id: string;
    name: string;
    type: LibraryItemType;
    children?: ITreeNode[];
    loading?: boolean;
    error?: boolean;
}

@Component({
    components: { ItemSettings },
})
export default class Library extends Vue {
    globalState = globalState;
    settingsOpen = false;
    settingsItem: LibraryItem | null = null;
    activeItem: LibraryItem | null = null;

    get items() {
        const audioFiles: ITreeNode = {
            id: "_folder_af",
            name: "Audio Files",
            children: [],
            type: LibraryItemType.AUDIO,
        };
        const graphs: ITreeNode = {
            id: "_folder_graphs",
            name: "Graphs",
            children: [],
            type: LibraryItemType.GRAPH,
        };
        const automationClips: ITreeNode = {
            id: "_folder_ac",
            name: "Automation Clips",
            children: [],
            type: LibraryItemType.AUTOMATION,
        };
        const notePatterns: ITreeNode = {
            id: "_folder_np",
            name: "Note Patterns",
            children: [],
            type: LibraryItemType.PATTERN,
        };
        const outputs: ITreeNode = {
            id: "_folder_op",
            name: "Outputs",
            children: [],
            type: LibraryItemType.OUTPUT,
        };
        const stages: ITreeNode = {
            id: "_folder_stages",
            name: "Stages",
            children: [],
            type: LibraryItemType.STAGE
        }
        const rootItems = [audioFiles, graphs, automationClips, notePatterns, outputs, stages];
        this.globalState.library.items.forEach((item) => {
            const itemData = {
                id: item.id,
                name: item.name,
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
    }

    public onActiveItemChanged(newActiveItems: string[]) {
        if (newActiveItems.length === 0 || newActiveItems[0].startsWith("_folder")) {
            this.activeItem = null;
        } else {
            this.activeItem = this.globalState.library.getItemById(newActiveItems[0]) ?? null;
        }
        this.$emit("item-selected", this.activeItem);
    }

    public openFileDialog() {
        (this.$refs.fileinput as HTMLElement).click();
    }

    public async loadAudio() {
        const f = (this.$refs.fileinput as HTMLInputElement).files;
        if (!f || f.length === 0) {
            return;
        }
        const item = new AudioLibraryItem();
        item.name = f[0].name;
        item.path = f[0].path;
        this.globalState.library.addItem(item);
        await item.load();
    }

    public dragstart(ev: DragEvent, itemId: string) {
        ev.dataTransfer!.setData("id", itemId);
    }

    public getIcon(type: LibraryItemType) {
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

    public addGraph() {
        this.globalState.library.addItem(new GraphLibraryItem());
    }

    public addAutomationClip() {
        this.globalState.library.addItem(new AutomationLibraryItem());
    }

    public addNotePattern() {
        this.globalState.library.addItem(new PatternLibraryItem());
    }

    public addOutput() {
        this.globalState.library.addItem(new OutputLibraryItem());
    }

    public addStage() {
        this.globalState.library.addItem(new StageLibraryItem());
    }

    public deleteItem(id: string) {
        this.globalState.library.removeItem(this.globalState.library.getItemById(id)!);
    }
}
</script>
