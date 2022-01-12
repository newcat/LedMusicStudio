<template>
    <div class="stage-editor">
        <div>
            <n-button>add</n-button>
            <n-button>play_circle_filled</n-button>
        </div>
        <div class="edit-area" v-if="editMode">
            <div class="prop-area">
                <prop-wrapper selected :prop="testProp"></prop-wrapper>
            </div>
            <div class="properties">Properties</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { PropWrapper } from "./components";
import { StripProp } from "./props/strip/strip";

const editMode = ref(true);
const testProp = ref(new StripProp());
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
