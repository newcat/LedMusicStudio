<template>
    <splitpanes>
        <pane min-size="10" size="15">
            <Library />
        </pane>
        <pane>
            <splitpanes horizontal>
                <pane>
                    <UnifiedEditor class="fill-height" />
                </pane>
                <pane>
                    <Timeline />
                </pane>
            </splitpanes>
        </pane>
    </splitpanes>
</template>

<script setup lang="ts">
// @ts-ignore
import { Splitpanes, Pane } from "splitpanes";

import Library from "@/library/Library.vue";
import UnifiedEditor from "@/components/UnifiedEditor.vue";
import Timeline from "@/timeline/Timeline.vue";
</script>
