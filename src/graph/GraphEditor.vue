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
import ContextMenu, { ContextMenuProps } from "primevue/contextmenu";
import { EditorComponent, Components, NodeInterface } from "baklavajs";
import { GraphLibraryItem } from "./graph.libraryItem";
import { Ref, ref } from "vue";

const NodeComponent = Components.Node;
const NodeInterfaceComponent = Components.NodeInterface;

const props = defineProps<{ graph: GraphLibraryItem }>();

const ctxMenu = ref<InstanceType<typeof ContextMenu>>();
const items = ref<ContextMenuProps["model"]>([{ label: "Add Keyframe", command: addKeyframe }]);
const currentInterface = ref<NodeInterface | null>(null) as Ref<NodeInterface | null>;

function onContextmenu(ev: PointerEvent, intf: NodeInterface) {
    currentInterface.value = intf;
    ctxMenu.value!.show(ev);
}

function addKeyframe() {
    if (!currentInterface.value) {
        return;
    }

    props.graph.keyframeManager.addKeyframe(currentInterface.value, currentInterface.value.value);
}
</script>
