<script setup lang="ts">
/**
 * Dev-only "Category mapping" tab of the asset workbench (feature 002, T066). Loads the bundled OFL library the same
 * way `src/stage/fixtures/dmx/fixtureLibrary.ts` does, runs `preselectForFixture` on every fixture (first mode) and
 * shows the counts per (type, model) plus the fixtures that fell back to `fixture.generic`.
 */
import { computed, ref } from "vue";
import Button from "primevue/button";
import type { Fixture as OflFixture } from "@/stage/fixtures/dmx/open-fixture";
import SelfHostedOfl from "@/stage/fixtures/dmx/ofl_export_ofl.zip?url";
import { preselectForFixture } from "@/assetLibrary";

interface MappedFixture {
    manufacturer: string;
    name: string;
    categories: string[];
    type: string;
    modelId: string;
    modelScale: number;
}

const loading = ref(false);
const error = ref<string | null>(null);
const mapped = ref<MappedFixture[]>([]);
const filter = ref<string | null>(null);

const counts = computed(() => {
    const map = new Map<string, { type: string; modelId: string; count: number }>();
    for (const f of mapped.value) {
        const key = `${f.type}|${f.modelId}`;
        const entry = map.get(key) ?? { type: f.type, modelId: f.modelId, count: 0 };
        entry.count++;
        map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
});
const fallbacks = computed(() => mapped.value.filter((f) => f.modelId === "fixture.generic"));
const listed = computed(() => (filter.value ? mapped.value.filter((f) => `${f.type}|${f.modelId}` === filter.value) : fallbacks.value));

async function load() {
    loading.value = true;
    error.value = null;
    try {
        const { loadAsync } = await import("jszip");
        const response = await fetch(SelfHostedOfl);
        const zip = await loadAsync(await response.blob());
        const manufacturerFile = zip.file("manufacturers.json");
        if (!manufacturerFile) {
            throw new Error("Invalid file format - could not find manufacturers.json");
        }
        const manufacturers: Record<string, { name: string }> = JSON.parse(await manufacturerFile.async("string"));
        const result: MappedFixture[] = [];
        for (const [key, manufacturer] of Object.entries(manufacturers)) {
            if (key === "$schema") {
                continue;
            }
            for (const file of zip.file(RegExp(`${key}/.*\\.json$`))) {
                if (file.dir) {
                    continue;
                }
                const fixture: OflFixture = JSON.parse(await file.async("string"));
                const preselection = preselectForFixture(fixture, fixture.modes?.[0] ?? null);
                result.push({
                    manufacturer: manufacturer.name,
                    name: fixture.name,
                    categories: fixture.categories ?? [],
                    type: preselection.visualizationType,
                    modelId: preselection.modelId,
                    modelScale: preselection.modelScale,
                });
            }
        }
        mapped.value = result;
    } catch (err) {
        error.value = String(err);
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2">
        <div class="flex items-center gap-4">
            <Button label="Load OFL library" size="small" :loading="loading" @click="load" />
            <span v-if="mapped.length">{{ mapped.length }} fixtures, {{ fallbacks.length }} fall back to fixture.generic</span>
            <span v-if="error" class="text-red-400">{{ error }}</span>
        </div>
        <div v-if="mapped.length" class="flex min-h-0 flex-1 gap-4">
            <table class="h-fit shrink-0 text-left">
                <thead>
                    <tr class="text-gray-400">
                        <th class="pr-4">Type</th>
                        <th class="pr-4">Model</th>
                        <th class="text-right">Fixtures</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="c in counts"
                        :key="`${c.type}|${c.modelId}`"
                        class="cursor-pointer hover:bg-gray-700"
                        :class="{ 'bg-gray-700': filter === `${c.type}|${c.modelId}` }"
                        @click="filter = filter === `${c.type}|${c.modelId}` ? null : `${c.type}|${c.modelId}`"
                    >
                        <td class="pr-4">{{ c.type }}</td>
                        <td class="pr-4">{{ c.modelId }}</td>
                        <td class="text-right">{{ c.count }}</td>
                    </tr>
                </tbody>
            </table>
            <div class="min-w-0 flex-1 overflow-auto">
                <div class="mb-1 font-semibold">{{ filter ? `Fixtures mapped to ${filter.replace("|", " → ")}` : "Fallbacks to fixture.generic" }}</div>
                <table class="text-left">
                    <tbody>
                        <tr v-for="(f, i) in listed" :key="i">
                            <td class="pr-4 text-gray-400">{{ f.manufacturer }}</td>
                            <td class="pr-4">{{ f.name }}</td>
                            <td class="pr-4 text-gray-400">{{ f.categories.join(", ") }}</td>
                            <td class="text-gray-400">×{{ f.modelScale }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
