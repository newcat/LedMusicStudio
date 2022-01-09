<template lang="pug">
.color-option
    .__name {{ name }}
    .__color
        d-color-picker(:value="color" @input="setColor")
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import ColorPicker from "./ColorPicker.vue";
import { fromChroma, Color, chroma, toChroma } from "../colors";

@Component({
    components: {
        "d-color-picker": ColorPicker,
    },
})
export default class ColorOption extends Vue {
    @Prop()
    name!: any;

    @Prop()
    value!: Color;

    get color() {
        if (!this.value) {
            return "#000000";
        } else {
            return toChroma(this.value).css();
        }
    }

    setColor(color: string) {
        this.$emit("input", fromChroma(chroma(color)));
    }
}
</script>

<style lang="scss" scoped>
.color-option {
    display: flex;

    & > .__name {
        flex-grow: 1;
    }

    & > .__color {
        width: 60px;
    }
}
</style>
