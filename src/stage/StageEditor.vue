<template>
    <div ref="rootEl" class="stage-editor"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { LibraryItemType, useLibrary } from "@/library";
import { isOutputLibraryItem } from "@/utils";
import { OutputLibraryItem, OutputType, WledOutput } from "@/output";
import { StageLibraryItem } from "./stage.libraryItem";
import { ThreeLedStrip } from "./ledStrip";

import testscene from "./testscene.json";

const props = defineProps<{
    stage: StageLibraryItem;
}>();

const library = useLibrary();

const rootEl = ref<HTMLElement>();
let continueAnimation = true;

onMounted(() => {
    if (!rootEl.value) {
        console.warn("rootEl is not set");
        return;
    }

    const stats = new Stats();
    const statsEl = stats.dom;
    statsEl.style.position = "absolute";
    rootEl.value.appendChild(statsEl);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(rootEl.value.clientWidth, rootEl.value.clientHeight);
    rootEl.value.appendChild(renderer.domElement);

    const loader = new THREE.ObjectLoader();
    const scene = loader.parse(testscene);

    const camera = scene.children.find((child) => child.type === "PerspectiveCamera") as THREE.PerspectiveCamera;
    if (!camera) {
        console.warn("Camera not found");
        return;
    }

    const ledStripMeshes = scene.children.filter((child) => child.userData?.type === "ledStrip") as THREE.Mesh[];
    const ledStrips: ThreeLedStrip[] = [];
    for (const mesh of ledStripMeshes) {
        const strip = new ThreeLedStrip(mesh, "");
        const output = library.items.find(
            (it) => isOutputLibraryItem(it) && it.outputInstance.type === OutputType.WLED
        ) as OutputLibraryItem;
        if (output) {
            console.log("Found output", output);
            strip.outputId = output.id;
            strip.updateState(output.outputInstance as WledOutput);
        }
        ledStrips.push(strip);
        scene.add(strip);
    }

    function render() {
        if (continueAnimation) {
            requestAnimationFrame(render);
        }
        stats.begin();
        ledStrips.forEach((strip) => {
            const data = props.stage.outputData.get(strip.outputId);
            if (data) {
                strip.updateData(data);
            }
        });
        renderer.render(scene, camera);
        stats.end();
    }
    render();
});

onBeforeUnmount(() => {
    continueAnimation = false;
});
</script>

<style scoped>
.stage-editor {
    width: 100%;
    height: 100%;
    position: relative;
}
</style>
