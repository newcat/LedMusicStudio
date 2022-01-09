<template lang="pug">
div
    v-text-field(outlined, label="Port", v-model="port")
    v-btn(text, @click="apply") Apply
    v-btn(text, @click="updateValues") Cancel
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { DmxOutput } from "./dmx.output";

@Component
export default class DmxOutputSettings extends Vue {
    port = "";

    @Prop()
    output!: DmxOutput;

    mounted() {
        this.updateValues();
    }

    updateValues() {
        const { port } = this.output.state;
        this.port = port;
    }

    apply() {
        this.output.applyState({
            port: this.port,
        });
        this.updateValues();
    }
}
</script>
