<template>
    <div class="flex flex-col gap-4">
        <div>
            <Button outlined label="Load Scene" @click="loadScene" />
        </div>
    </div>
</template>

<script setup lang="ts">
import Button from "primevue/button";

import { readFile, showOpenDialog } from "@/native";
import { useErrorHandler } from "@/utils";
import { useStage } from "../stage";

const errorHandler = useErrorHandler();
const stage = useStage();

async function loadScene() {
    const result = await showOpenDialog({ title: "Load Scene", filters: [{ name: "Stage Scene", extensions: ["json"] }] });
    if (result.canceled || result.filePaths.length !== 1) {
        return;
    }

    errorHandler("Could not load scene", async () => {
        const timeoutSymbol = Symbol("timeout");
        const rawData = await Promise.race([
            readFile(result.filePaths[0], { encoding: "utf-8" }),
            new Promise<symbol>((res) => setTimeout(res, 5000, timeoutSymbol)),
        ]);
        if (rawData === timeoutSymbol) {
            throw new Error("Timeout while reading data");
        }

        stage.visualization.loadScene(JSON.parse(rawData as string));
    });
}
</script>
