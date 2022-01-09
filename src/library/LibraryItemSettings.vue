<template lang="pug">
v-dialog(:value="value", @input="$emit('input', $event)" max-width="400")
    v-card
        v-card-title
            .headline Edit Library Item
        v-card-text
            v-text-field(outlined, label="Name", v-model="vName")
        v-card-actions
            v-btn(text, @click="remove") Delete
            v-spacer
            v-btn(text, @click="cancel") Cancel
            v-btn(text, @click="save") Save
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import { globalState } from "@/globalState";
import { LibraryItem } from "./libraryItem";

@Component
export default class Settings extends Vue {
    @Prop()
    value!: boolean;

    @Prop()
    item!: LibraryItem;

    vName = "";

    @Watch("value")
    updateValues() {
        this.vName = this.item.name;
    }

    remove() {
        this.$emit("input", false);
        globalState.library.removeItem(this.item);
    }

    cancel() {
        this.$emit("input", false);
    }

    save() {
        this.$emit("input", false);
        this.item.name = this.vName;
    }
}
</script>
