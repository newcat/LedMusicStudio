<template>
    <div class="output-editor">
        <div class="empty">
            <div>This output has no configuration</div>
        </div>
    </div>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.output-editor {
    margin: 1rem;
    margin-bottom: 0;
    width: calc(100% - 2rem);
    height: calc(100% - 1rem);
}

.empty {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 2rem;
}
</style>
