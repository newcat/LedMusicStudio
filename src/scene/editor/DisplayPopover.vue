<template>
    <div class="display-menu">
        <Button outlined size="small" icon="mdi mdi-monitor" label="Display" @click="popover?.toggle($event)" />
        <Popover ref="popover">
            <div class="display-panel">
                <label class="field-label">Editor quality</label>
                <SelectButton v-model="editorQuality" :options="qualityOptions" option-label="label" option-value="value" :allow-empty="false" size="small" aria-label="Editor quality" />

                <label class="field-label">Show window quality</label>
                <SelectButton v-model="showQuality" :options="qualityOptions" option-label="label" option-value="value" :allow-empty="false" size="small" aria-label="Show window quality" />

                <div class="checkbox-row">
                    <Checkbox v-model="editorShowFps" input-id="display-fps-editor" binary />
                    <label for="display-fps-editor">Show frame rate in the editor</label>
                </div>
                <div class="checkbox-row">
                    <Checkbox v-model="showShowFps" input-id="display-fps-show" binary />
                    <label for="display-fps-show">Show frame rate in the show window</label>
                </div>

                <div class="checkbox-row">
                    <Checkbox v-model="photosensitivityLimit" input-id="display-flash-limit" binary />
                    <label for="display-flash-limit">Limit flash rate</label>
                </div>
                <div class="hint">Limits strobes and flashes to 3 per second (photosensitivity).</div>

                <div class="checkbox-row">
                    <Checkbox v-model="showTrueStrobeRate" input-id="display-true-strobe" binary :disabled="photosensitivityLimit" />
                    <label for="display-true-strobe" :class="{ disabled: photosensitivityLimit }">Show true strobe rate</label>
                </div>
            </div>
        </Popover>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Popover from "primevue/popover";
import SelectButton from "primevue/selectbutton";

import { useViewPreferences, viewPreferences } from "@/visualization/viewPreferences";
import type { QualityLevel } from "@/visualization/quality";

const prefs = useViewPreferences();
const popover = ref<InstanceType<typeof Popover>>();

const qualityOptions: Array<{ label: string; value: QualityLevel }> = [
    { label: "Low", value: "low" },
    { label: "Medium", value: "medium" },
    { label: "High", value: "high" },
];

const editorQuality = computed({
    get: () => prefs.value.editor.quality,
    set: (quality: QualityLevel) => {
        viewPreferences.update((p) => {
            p.editor.quality = quality;
        });
    },
});

const showQuality = computed({
    get: () => prefs.value.show.quality,
    set: (quality: QualityLevel) => {
        viewPreferences.update((p) => {
            p.show.quality = quality;
        });
    },
});

const editorShowFps = computed({
    get: () => prefs.value.editor.showFps,
    set: (showFps: boolean) => {
        viewPreferences.update((p) => {
            p.editor.showFps = showFps;
        });
    },
});

const showShowFps = computed({
    get: () => prefs.value.show.showFps,
    set: (showFps: boolean) => {
        viewPreferences.update((p) => {
            p.show.showFps = showFps;
        });
    },
});

const photosensitivityLimit = computed({
    get: () => prefs.value.photosensitivityLimit,
    set: (limit: boolean) => viewPreferences.update({ photosensitivityLimit: limit }),
});

const showTrueStrobeRate = computed({
    get: () => prefs.value.showTrueStrobeRate,
    set: (show: boolean) => viewPreferences.update({ showTrueStrobeRate: show }),
});
</script>

<style scoped>
.display-menu {
    display: inline-flex;
}

.display-panel {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: 22rem;
}

.field-label {
    font-size: 0.875rem;
    opacity: 0.85;
}

.checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.checkbox-row label.disabled {
    opacity: 0.5;
}

.hint {
    font-size: 0.8rem;
    opacity: 0.7;
}
</style>
