<template>
    <div class="visualization">
        <SceneEditor />
    </div>
</template>

<script setup lang="ts">
import SceneEditor from "@/scene/editor/SceneEditor.vue";
</script>

<style scoped>
.visualization {
    flex: 1;
    min-width: 0;
    min-height: 0;
    height: 100%;
}
</style>
