<template>
<n-el class="toolbar" style="background-color: var(--card-color);">
    <slot></slot>
</n-el>
</template>

<script setup lang="ts">
import { NEl } from "naive-ui";
</script>

<style scoped>
.toolbar {
    display: flex;
    height: 3rem;
    padding: 0.5rem;
    align-items: center;
}
</style>