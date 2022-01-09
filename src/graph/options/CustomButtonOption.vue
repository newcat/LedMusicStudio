<template>
    <div>
        <button class="dark-button" style="width: 100%" @click="onClick">{{ name }}</button>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import { Node } from "@baklavajs/core";

@Component
export default class CustomButtonOption extends Vue {
    @Prop()
    node!: Node;

    @Prop()
    name!: string;

    onClick() {
        (this.node as any).onButtonClick(this.name);
    }
}
</script>
