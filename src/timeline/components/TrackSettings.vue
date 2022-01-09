<template lang="pug">
v-dialog(:value="value", @input="$emit('input', $event)" max-width="400")
    v-card
        v-card-title
            .headline Edit Track
        v-card-text
            v-text-field(outlined, label="Name", v-model="vName")
        v-card-actions
            v-spacer
            v-btn(text, @click="cancel") Cancel
            v-btn(text, @click="save") Save
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import { Track } from "../model";

@Component
export default class TrackSettings extends Vue {
    @Prop()
    value!: boolean;

    @Prop()
    track!: Track;

    vName = "";

    @Watch("value")
    updateValues() {
        this.vName = this.track.name;
    }

    cancel() {
        this.$emit("input", false);
    }

    save() {
        this.$emit("input", false);
        this.track.name = this.vName;
    }
}
</script>
