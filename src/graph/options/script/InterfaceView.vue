<template>
    <div class="flex items-center gap-4">
        <div v-if="!editmode" class="grow">{{ intf.name }} ({{ typeNames[type] }})</div>
        <template v-else>
            <InputText v-model="tempname" />
            <Dropdown v-model="type" :options="typeOptions" option-label="label" option-value="value" />
        </template>
        <Button text size="small" @click="toggle">{{ editmode ? "Save" : "Edit" }}</Button>
        <Button text size="small" @click="emit('remove')">Remove</Button>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Dropdown from "primevue/dropdown";
import { NodeInterface } from "baklavajs";

import { BooleanType, ColorArrayType, ColorSingleType, NumberType } from "@/graph/interface-types";

const props = defineProps<{
    intf: NodeInterface;
}>();

const emit = defineEmits<{
    remove: [];
    rename: [string];
}>();

const editmode = ref(false);
const tempname = ref("");

const type = computed<string>({
    get: () => (props.intf as any).type ?? "NONE",
    set: (v) => {
        (props.intf as any).type = v === "NONE" ? undefined : v;
    },
});

const typeNames: Record<string, string> = {
    NONE: "No type",
    [BooleanType.name]: "Boolean",
    [NumberType.name]: "Number",
    [ColorSingleType.name]: "Color",
    [ColorArrayType.name]: "Color Array",
};

const typeOptions = [{ label: "No type", value: "NONE" }].concat(
    [BooleanType, NumberType, ColorSingleType, ColorArrayType].map((t) => ({
        label: typeNames[t.name],
        value: t.name,
    }))
);

function toggle() {
    if (!editmode.value) {
        tempname.value = props.intf.name;
        editmode.value = true;
    } else {
        editmode.value = false;
        emit("rename", tempname.value);
    }
}
</script>
