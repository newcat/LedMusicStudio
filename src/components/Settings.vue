<template lang="pug">
v-dialog(:value="value", @input="$emit('input', $event)" max-width="400")
    v-card
        v-card-title
            .headline Settings
        v-card-text
            v-text-field(outlined, label="Resolution", v-model="vResolution")
            v-text-field(outlined, label="FPS", v-model="vFps")
        v-card-actions
            v-spacer
            v-btn(text, @click="cancel") Cancel
            v-btn(text, @click="save") Save
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import { globalState } from "@/globalState";

@Component
export default class Settings extends Vue {
    @Prop()
    value!: boolean;

    vResolution = "0";
    vFps = "0";

    @Watch("value")
    updateValues() {
        this.vResolution = globalState.resolution.toString();
        this.vFps = globalState.fps.toString();
    }

    cancel() {
        this.$emit("input", false);
    }

    save() {
        this.$emit("input", false);
        // TODO: Validation
        globalState.resolution = parseInt(this.vResolution, 10);
        globalState.fps = parseInt(this.vFps, 10);
    }
}
</script>
