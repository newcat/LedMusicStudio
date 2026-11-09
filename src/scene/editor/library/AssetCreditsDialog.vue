<template>
    <Dialog v-model:visible="visible" modal header="Asset credits" :style="{ width: '44rem' }" :breakpoints="{ '720px': '95vw' }">
        <p class="intro">Built-in 3D assets and their licenses.</p>
        <div class="credits-body">
            <section v-for="group in groups" :key="group.category">
                <h3>{{ group.title }}</h3>
                <div v-for="asset in group.assets" :key="asset.id" class="row">
                    <div class="name">
                        {{ asset.name }}
                        <span v-if="asset.credits.madeForProject" class="badge">made for LEDMusic Studio</span>
                    </div>
                    <div class="author">{{ asset.credits.author }}</div>
                    <div class="source">
                        <a v-if="asset.credits.source.startsWith('http')" :href="asset.credits.source" target="_blank" rel="noopener">
                            {{ asset.credits.source }}
                        </a>
                        <template v-else>{{ asset.credits.source }}</template>
                    </div>
                    <div class="license">
                        <a :href="`https://spdx.org/licenses/${asset.credits.license}.html`" target="_blank" rel="noopener">
                            {{ asset.credits.license }}
                        </a>
                    </div>
                </div>
            </section>
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Dialog from "primevue/dialog";

import { assetCatalog } from "@/assetLibrary/catalog";
import type { AssetCategory } from "@/assetLibrary/types";

const visible = defineModel<boolean>("visible", { default: false });

const TITLES: Record<AssetCategory, string> = {
    fixtures: "Fixtures",
    stage: "Stage",
    decoration: "Decoration",
    shapes: "Basic shapes",
};

const groups = computed(() =>
    (Object.keys(TITLES) as AssetCategory[])
        .map((category) => ({
            category,
            title: TITLES[category],
            assets: assetCatalog.all().filter((a) => a.category === category),
        }))
        .filter((g) => g.assets.length > 0)
);
</script>

<style scoped>
.intro {
    margin: 0 0 0.75rem;
    opacity: 0.85;
}

.credits-body {
    max-height: 60vh;
    overflow-y: auto;
    user-select: text;
}

h3 {
    margin: 0.75rem 0 0.25rem;
    font-size: 0.95rem;
}

.row {
    display: grid;
    grid-template-columns: 1.4fr 1.2fr 1.4fr 1fr;
    gap: 0.5rem;
    padding: 0.25rem 0;
    font-size: 0.85rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.badge {
    display: inline-block;
    margin-left: 0.4rem;
    padding: 0 0.4rem;
    font-size: 0.7rem;
    border-radius: 999px;
    background: var(--p-primary-color, #38bdf8);
    color: black;
}

a {
    color: var(--p-primary-color, #38bdf8);
    overflow-wrap: anywhere;
}
</style>
