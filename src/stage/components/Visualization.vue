<template>
    <div class="flex flex-col gap-4">
        <div>
            <Button outlined label="Load Scene" @click="loadScene" />
        </div>
    </div>
</template>

<script setup lang="ts">
import Button from "primevue/button";

import { getNativeAdapter } from "@/native";
import { useErrorHandler } from "@/utils";
import { useStage } from "../stage";

const errorHandler = useErrorHandler();
const stage = useStage();
const nativeAdapter = getNativeAdapter();

async function loadScene() {
    const result = await nativeAdapter.chooseAndReadFile({
        accept: [{ name: "Stage Scene", extensions: ["json"] }],
    });
    if (!result) {
        return;
    }

    errorHandler("Could not load scene", async () => {
        stage.visualization.loadScene(JSON.parse(result.dataAsString));
    });
}
</script>
