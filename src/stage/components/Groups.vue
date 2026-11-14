<template>
    <div class="groups">
        <div class="col-span-2 flex gap-4">
            <Button outlined icon="pi pi-plus" label="Add Group" @click="addGroup"></Button>
        </div>
        <Listbox v-model="selectedGroupId" :options="stage.groups" option-label="name" option-value="id" empty-message="No groups added." scroll-height="">
            <template #option="{ option }">
                <div class="flex items-center gap-2 w-full">
                    <i class="mdi mdi-lamps"></i>
                    <div class="grow">{{ option.name }}</div>
                    <span class="text-xs opacity-70">{{ option.fixtureIds.length }}</span>
                </div>
            </template>
        </Listbox>
        <Panel header="Group Settings" class="flex flex-col overflow-auto" :pt="{ contentContainer: { class: 'overflow-auto' }, content: { class: 'h-full' } }">
            <template #icons>
                <Button v-tooltip.left="'Delete Group'" icon="pi pi-trash" severity="secondary" rounded text :disabled="!group" @click="deleteGroup"></Button>
            </template>
            <div v-if="group" class="flex flex-col gap-4">
                <LabelledFormField label="Name">
                    <InputText :model-value="group.name" @change="rename(($event.target as HTMLInputElement).value)" />
                </LabelledFormField>
                <LabelledFormField label="Members">
                    <MultiSelect
                        :model-value="group.fixtureIds"
                        :options="dmxFixtures"
                        option-label="name"
                        option-value="id"
                        filter
                        display="chip"
                        placeholder="Choose DMX fixtures"
                        class="w-full"
                        @update:model-value="setMembers"
                    />
                </LabelledFormField>
                <LabelledFormField label="Ordering">
                    <Select :model-value="group.ordering" :options="GROUP_ORDERINGS" option-label="label" option-value="value" @update:model-value="setOrdering" />
                </LabelledFormField>
                <div>
                    <div class="mb-2">
                        Order
                        <span class="text-sm opacity-70">{{ group.ordering === "manual" ? "(drag to reorder)" : "(from the 3D scene)" }}</span>
                    </div>
                    <ol class="order-list">
                        <li
                            v-for="(entry, i) in resolved"
                            :key="entry.fixtureId"
                            class="order-item"
                            :class="{ '--draggable': group.ordering === 'manual', '--over': dragOver === i }"
                            :draggable="group.ordering === 'manual'"
                            @dragstart="dragFrom = manualIndex(entry.fixtureId)"
                            @dragover.prevent="dragOver = i"
                            @dragleave="dragOver = null"
                            @drop.prevent="drop(entry.fixtureId)"
                        >
                            <span class="index">{{ i + 1 }}</span>
                            <i v-if="group.ordering === 'manual'" class="mdi mdi-drag"></i>
                            <span class="grow">{{ fixtureName(entry.fixtureId) }}</span>
                            <i v-if="!entry.position" v-tooltip.left="'No scene position: placed last in automatic orders'" class="mdi mdi-map-marker-off opacity-70"></i>
                        </li>
                    </ol>
                    <div v-if="resolved.length === 0" class="text-sm opacity-70">The group is empty.</div>
                </div>
            </div>
        </Panel>
        <ConfirmDialog group="delete-group" />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "primevue/button";
import Listbox from "primevue/listbox";
import Panel from "primevue/panel";
import InputText from "primevue/inputtext";
import MultiSelect from "primevue/multiselect";
import Select from "primevue/select";
import ConfirmDialog from "primevue/confirmdialog";
import { useConfirm } from "primevue/useconfirm";

import LabelledFormField from "@/components/LabelledFormField.vue";
import { GROUP_ORDERINGS, type GroupOrdering } from "@/programming/types";
import { fixturePosition, orderGroup } from "@/programming/targets";
import { groupUses } from "@/programming/uses";
import { FixtureType } from "../fixtures";
import { useStage } from "../stage";

const stage = useStage();
const confirm = useConfirm();

const selectedGroupId = ref<string | null>(stage.groups[0]?.id ?? null);
const group = computed(() => stage.groups.find((g) => g.id === selectedGroupId.value) ?? null);
const dmxFixtures = computed(() => Array.from(stage.fixtures.values()).filter((f) => f.type === FixtureType.DMX));
const resolved = computed(() => (group.value ? orderGroup(group.value, fixturePosition) : []));

const dragFrom = ref<number | null>(null);
const dragOver = ref<number | null>(null);

function fixtureName(id: string): string {
    return stage.fixtures.get(id)?.name ?? id;
}

function addGroup() {
    selectedGroupId.value = stage.addGroup("Group").id;
}

function rename(name: string) {
    if (group.value) {
        stage.renameGroup(group.value.id, name);
    }
}

function setMembers(ids: string[]) {
    if (group.value) {
        stage.setGroupMembers(group.value.id, ids);
    }
}

function setOrdering(ordering: GroupOrdering) {
    if (group.value) {
        stage.setGroupOrdering(group.value.id, ordering);
    }
}

function manualIndex(fixtureId: string): number {
    return group.value?.fixtureIds.indexOf(fixtureId) ?? -1;
}

function drop(targetFixtureId: string) {
    dragOver.value = null;
    if (group.value && dragFrom.value !== null && group.value.ordering === "manual") {
        stage.moveGroupMember(group.value.id, dragFrom.value, manualIndex(targetFixtureId));
    }
    dragFrom.value = null;
}

function deleteGroup() {
    const g = group.value;
    if (!g) {
        return;
    }
    const remove = () => {
        stage.removeGroup(g.id);
        selectedGroupId.value = stage.groups[0]?.id ?? null;
    };
    const uses = groupUses(g.id);
    if (uses === 0) {
        remove();
        return;
    }
    confirm.require({
        group: "delete-group",
        header: "Delete group",
        message: `"${g.name}" is the target of ${uses} clip${uses === 1 ? "" : "s"} or track${uses === 1 ? "" : "s"}. They will have no target. Delete anyway?`,
        icon: "pi pi-exclamation-triangle",
        acceptLabel: "Delete",
        rejectLabel: "Cancel",
        accept: remove,
    });
}
</script>

<style scoped>
.groups {
    width: 100%;
    height: 100%;
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr 2fr;
    grid-template-rows: min-content auto;
}

.order-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.order-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: var(--p-content-border-radius);
    background: var(--p-content-hover-background);
    border: 1px solid transparent;
}

.order-item.--draggable {
    cursor: grab;
}

.order-item.--over {
    border-color: var(--p-primary-color);
}

.index {
    width: 1.5rem;
    opacity: 0.7;
    text-align: right;
}
</style>
