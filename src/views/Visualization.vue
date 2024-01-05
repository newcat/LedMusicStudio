<template>
    <splitpanes horizontal>
        <pane>
            <StageView />
        </pane>
        <pane>
            <Timeline />
        </pane>
    </splitpanes>
</template>

<script setup lang="ts">
// @ts-ignore
import { Splitpanes, Pane } from "splitpanes";

import Timeline from "@/timeline/Timeline.vue";
import StageView from "@/stage/visualization/StageView.vue";
</script>
