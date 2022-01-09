<template lang="pug">
.color-picker(@click.self="open = true", :style="styles", v-click-outside="() => { open = false; }")
    transition(name="slide-fade")
        cp-chrome.color-picker-overlay(v-show="open", :value="value", @input="$emit('input', $event.hex)")
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
// @ts-ignore
import { Chrome } from "vue-color";
// @ts-ignore
import ClickOutside from "v-click-outside";

@Component({
    components: {
        "cp-chrome": Chrome,
    },
    directives: {
        ClickOutside: ClickOutside.directive,
    },
})
export default class ColorPicker extends Vue {
    @Prop({ type: String, default: "#000000" })
    value!: string;

    open = false;

    get styles() {
        return {
            "background-color": this.value,
        };
    }
}
</script>

<style scoped>
.color-picker {
    height: 100%;
    border-radius: 3px;
}

.color-picker-overlay {
    position: absolute;
    left: 100%;
    top: 0%;
    z-index: 100;
}
</style>
