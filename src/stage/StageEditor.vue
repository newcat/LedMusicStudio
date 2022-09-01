<template>
    <div class="stage-editor">
        <n-menu mode="horizontal" :options="menuOptions" />
        <n-divider class="my-1"></n-divider>
        <splitpanes>
            <pane class="prop-area" @click.self="selectedProp = null">
                <prop-wrapper :selected="selectedProp === testProp" :prop="testProp" @select="selectedProp = testProp"></prop-wrapper>
            </pane>
            <pane class="properties" size="20">
                <n-h2>Properties</n-h2>
            </pane>
        </splitpanes>
    </div>
</template>

<script setup lang="ts">
import { MenuOption, NMenu, NDivider, NH2 } from "naive-ui";
import { ref } from "vue";
import { PropWrapper } from "./components";
import { StripProp } from "./props/strip/strip";

// @ts-ignore
import { Splitpanes, Pane } from "splitpanes";
import { Prop } from "./props";

const editMode = ref(true);
const testProp = ref(new StripProp());
const selectedProp = ref<Prop | null>(null);

const menuOptions: MenuOption[] = [
    {
        label: "Add",
        key: "add",
        children: [{ label: "Linear Fixture", key: "linearFixture" }],
    },
];
</script>

<style scoped>
.stage-editor {
    width: 100%;
    height: 100%;
}

.prop-area {
    height: 100%;
}

.properties {
    height: 100%;
    padding: 1rem;
}

.splitpanes > :deep(.splitpanes__splitter) {
    min-width: 2px;
    background-color: var(--n-border-color);
}
</style>
