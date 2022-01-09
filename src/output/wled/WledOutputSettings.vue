<template lang="pug">
div
    v-text-field(outlined, label="Host", v-model="host")
    v-text-field(outlined, type="number", step="1", label="Port", v-model="port")
    v-text-field(outlined, type="number", step="1", label="Timeout", v-model="timeout")
    v-text-field(outlined, type="number", step="1", label="Led Count", v-model="numLeds")
    v-btn(text, @click="apply") Apply
    v-btn(text, @click="updateValues") Cancel
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { WledOutput } from "./wled.output";

@Component
export default class WledOutputSettings extends Vue {
    host = "";
    port = 0;
    timeout = 0;
    numLeds = 0;

    @Prop()
    output!: WledOutput;

    mounted() {
        this.updateValues();
    }

    updateValues() {
        const { host, port, timeout, numLeds } = this.output.state;
        this.host = host;
        this.port = port;
        this.timeout = timeout;
        this.numLeds = numLeds;
    }

    apply() {
        this.output.applyState({
            host: this.host,
            port: this.port,
            timeout: this.timeout,
            numLeds: this.numLeds,
        });
        this.updateValues();
    }
}
</script>

<style lang="css" scoped>
.settings-container {
    max-width: 30em;
}
</style>
