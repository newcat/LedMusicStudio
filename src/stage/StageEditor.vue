<template lang="pug">
.stage-editor
    v-toolbar(dense, flat)
        v-btn(icon)
            v-icon add
        v-btn(icon)
            v-icon play_circle_filled
    .edit-area(v-if="editMode")
        .prop-area
            prop-wrapper(selected, :prop="testProp")
        .properties Properties
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { PropWrapper } from "./components";
import { StripProp } from "./props/strip/strip";

@Component({
    components: { PropWrapper },
})
export default class StageEditor extends Vue {
    editMode = true;

    testProp = new StripProp();
}
</script>

<style scoped>
.stage-editor {
    width: 100%;
    height: 100%;
}

.edit-area {
    display: flex;
}

.prop-area {
    flex-grow: 1;
}

.properties {
    width: 300px;
}
</style>
