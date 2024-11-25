<template>
    <EditorComponent :view-model="graph.editor.viewModel">
        <template #node="nodeProps">
            <NodeComponent v-bind="nodeProps">
                <template #nodeInterface="niProps">
                    <NodeInterfaceComponent v-bind="niProps" @contextmenu="onContextmenu($event, niProps.intf)" />
                </template>
            </NodeComponent>
        </template>
    </EditorComponent>
    <ContextMenu ref="ctxMenu" :model="items" />
</template>

<script setup lang="ts">
import { Ref, ref } from "vue";
import ContextMenu, { ContextMenuProps } from "primevue/contextmenu";
import { EditorComponent, Components, NodeInterface } from "baklavajs";
import { GraphLibraryItem } from "./graph.libraryItem";

import "./styles.css";

const NodeComponent = Components.Node;
const NodeInterfaceComponent = Components.NodeInterface;

const props = defineProps<{ graph: GraphLibraryItem }>();

const ctxMenu = ref<InstanceType<typeof ContextMenu>>();
const items = ref<ContextMenuProps["model"]>([
    { label: "Add Keyframe", command: addKeyframe },
    { label: "Remove Keyframe", command: removeKeyframe },
]);
const currentInterface = ref<NodeInterface | null>(null) as Ref<NodeInterface | null>;

function onContextmenu(ev: PointerEvent, intf: NodeInterface) {
    if (!intf.isInput) {
        return;
    }

    currentInterface.value = intf;
    ctxMenu.value!.show(ev);
}

function addKeyframe() {
    if (!currentInterface.value) {
        return;
    }

    props.graph.keyframeManager.addKeyframe(currentInterface.value, currentInterface.value.value);
}

function removeKeyframe() {
    if (!currentInterface.value) {
        return;
    }

    props.graph.keyframeManager.removeKeyframe(currentInterface.value.id);
}
</script>
