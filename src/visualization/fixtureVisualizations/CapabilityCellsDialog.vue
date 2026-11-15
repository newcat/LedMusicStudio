<template>
    <Dialog v-model:visible="visible" modal header="Pixel cells" :style="{ width: 'min(56rem, 90vw)' }">
        <div class="cells-wrapper">
            <table class="cells">
                <thead>
                    <tr>
                        <th>Emitter</th>
                        <th>Pixel</th>
                        <th v-for="field in CELL_FIELDS" :key="field.key">{{ field.label }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(cell, i) in cells" :key="i">
                        <td>{{ cell.emitter }}</td>
                        <td>{{ cell.pixelKey }}</td>
                        <td v-for="field in CELL_FIELDS" :key="field.key">
                            <Select
                                :model-value="cell[field.key]"
                                :options="channelOptions"
                                option-label="label"
                                option-value="value"
                                size="small"
                                class="channel"
                                :aria-label="`${cell.emitter} ${field.label}`"
                                @update:model-value="setChannel(i, field.key, $event)"
                            />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div v-if="emitterCount !== undefined && cells.length !== emitterCount" class="hint">
            {{ cells.length }} pixels are spread over {{ emitterCount }} model cells.
        </div>
        <template #footer>
            <Button label="Close" size="small" @click="visible = false" />
        </template>
    </Dialog>
</template>

<script setup lang="ts">
/** Cell table of a pixel fixture (feature 006, research R14); every edit is emitted right away as new cells. */
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import Select from "primevue/select";

import type { CellMapping } from "../capabilities/types";

type CellChannelField = Exclude<keyof CellMapping, "emitter" | "pixelKey">;

const CELL_FIELDS: Array<{ key: CellChannelField; label: string }> = [
    { key: "red", label: "R" },
    { key: "green", label: "G" },
    { key: "blue", label: "B" },
    { key: "white", label: "W" },
    { key: "amber", label: "A" },
    { key: "uv", label: "UV" },
    { key: "dimmer", label: "Dimmer" },
];

const props = defineProps<{
    cells: CellMapping[];
    channelOptions: Array<{ label: string; value: number }>;
    /** number of `cell-*` emitters of the model */
    emitterCount?: number;
}>();

const emit = defineEmits<{
    "update:cells": [cells: CellMapping[]];
}>();

const visible = defineModel<boolean>("visible", { required: true });

function setChannel(index: number, field: CellChannelField, channel: number) {
    const copy = JSON.parse(JSON.stringify(props.cells)) as CellMapping[];
    copy[index][field] = channel;
    emit("update:cells", copy);
}
</script>

<style scoped>
.cells-wrapper {
    overflow-x: auto;
}

.cells {
    border-collapse: collapse;
    font-size: 0.875rem;
}

.cells th {
    text-align: left;
    font-weight: normal;
    color: var(--p-text-muted-color);
    padding: 0 0.5rem 0.25rem 0;
}

.cells td {
    padding: 0.2rem 0.5rem 0.2rem 0;
    white-space: nowrap;
}

.channel {
    width: 8rem;
}

.hint {
    margin-top: 0.5rem;
    font-size: 0.8125rem;
    color: var(--p-text-muted-color);
}
</style>
