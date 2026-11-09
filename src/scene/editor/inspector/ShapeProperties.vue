<template>
    <div class="shape-properties">
        <LabelledFormField label="Shape">
            <InputText :model-value="object.shape" disabled />
        </LabelledFormField>
        <div class="dimensions">
            <LabelledFormField v-for="dimension in dimensionKeys" :key="dimension" :label="`${capitalize(dimension)} (m)`">
                <InputNumber
                    :model-value="dimensionValue(dimension)"
                    :min="0.01"
                    :min-fraction-digits="0"
                    :max-fraction-digits="3"
                    :step="0.1"
                    size="small"
                    fluid
                    @update:model-value="setDimension(dimension, $event)"
                />
            </LabelledFormField>
        </div>
        <MaterialField :material="object.material" :color="object.color" @update:material="setMaterial" @update:color="setColor" />
        <div class="world-size">World size: {{ worldSize }} m</div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";

import LabelledFormField from "@/components/LabelledFormField.vue";
import MaterialField from "./MaterialField.vue";
import type { MaterialPresetId } from "@/assetLibrary/types";
import { useScene } from "../../sceneStore";
import type { ShapeObject } from "../../model/types";

const props = defineProps<{
    object: ShapeObject;
}>();

const store = useScene();

const dimensionKeys = computed(() => Object.keys(props.object.dimensions));

function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function dimensionValue(key: string): number {
    return (props.object.dimensions as Record<string, number>)[key];
}

function setDimension(key: string, value: number | null) {
    if (value === null || !Number.isFinite(value)) {
        return;
    }
    const dimensions = { ...props.object.dimensions, [key]: Math.max(0.01, value) };
    store.updateObjects({ [props.object.id]: { dimensions } as Partial<ShapeObject> }, "Edit dimensions", `dimension:${props.object.id}:${key}`);
}

function setColor(color: string) {
    store.updateObjects({ [props.object.id]: { color } as Partial<ShapeObject> }, "Edit color", `color:${props.object.id}`);
}

function setMaterial(material: MaterialPresetId | null) {
    store.setShapeMaterial(props.object.id, material);
}

/** dimensions x scale */
const worldSize = computed(() => {
    const [sx, sy, sz] = props.object.scale;
    const f = (n: number) => Number(n.toFixed(3));
    switch (props.object.shape) {
        case "box":
            return `${f(props.object.dimensions.width * sx)} × ${f(props.object.dimensions.height * sy)} × ${f(props.object.dimensions.depth * sz)}`;
        case "cylinder":
            return `${f(props.object.dimensions.radius * 2 * sx)} × ${f(props.object.dimensions.height * sy)} × ${f(props.object.dimensions.radius * 2 * sz)}`;
        case "plane":
            return `${f(props.object.dimensions.width * sx)} × ${f(props.object.dimensions.depth * sz)}`;
        case "sphere":
            return `${f(props.object.dimensions.radius * 2 * sx)} × ${f(props.object.dimensions.radius * 2 * sy)} × ${f(props.object.dimensions.radius * 2 * sz)}`;
        default:
            return "";
    }
});
</script>

<style scoped>
.shape-properties {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.dimensions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 0.5rem;
}

.world-size {
    font-size: 0.8rem;
    opacity: 0.7;
}
</style>
