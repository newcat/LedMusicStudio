<template>
    <div class="environment-menu">
        <Button outlined size="small" icon="mdi mdi-weather-fog" label="Environment" @click="popover?.toggle($event)" />
        <Popover ref="popover">
            <div class="environment-panel">
                <label class="field-label" for="environment-haze">Haze</label>
                <div class="haze-row">
                    <Slider id="environment-haze" v-model="hazePercent" :min="0" :max="100" :step="1" class="haze-slider" />
                    <InputNumber
                        v-model="hazePercent"
                        :min="0"
                        :max="100"
                        :max-fraction-digits="0"
                        suffix=" %"
                        size="small"
                        class="haze-input"
                        aria-label="Haze in percent"
                    />
                </div>

                <div class="checkbox-row">
                    <Checkbox input-id="environment-hazer-coupling" :model-value="environment.hazerCoupling" binary @update:model-value="setHazerCoupling" />
                    <label for="environment-hazer-coupling">Hazers raise haze</label>
                </div>
                <div class="hint">Active fog/haze fixtures increase the haze while they run.</div>

                <template v-for="view in AMBIENT_VIEWS" :key="view.kind">
                    <label class="field-label" :for="`environment-ambient-${view.kind}`">{{ view.label }}</label>
                    <div class="ambient-row">
                        <Select
                            :input-id="`environment-ambient-${view.kind}`"
                            :model-value="environment.ambient[view.kind].preset"
                            :options="AMBIENT_PRESETS"
                            option-label="label"
                            option-value="value"
                            size="small"
                            class="ambient-select"
                            @update:model-value="(preset: AmbientPreset) => setAmbient(view.kind, { preset })"
                        />
                        <Slider
                            :model-value="Math.round(environment.ambient[view.kind].brightness * 100)"
                            :min="0"
                            :max="200"
                            :step="1"
                            class="ambient-slider"
                            :aria-label="`${view.label} brightness`"
                            @update:model-value="(value: number | number[]) => setBrightness(view.kind, value)"
                        />
                        <span class="ambient-value">{{ Math.round(environment.ambient[view.kind].brightness * 100) }} %</span>
                    </div>
                </template>
            </div>
        </Popover>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import InputNumber from "primevue/inputnumber";
import Popover from "primevue/popover";
import Select from "primevue/select";
import Slider from "primevue/slider";

import type { AmbientPreset, AmbientSetting } from "../model/types";
import { useScene } from "../sceneStore";

type AmbientView = "editor" | "show";

const AMBIENT_VIEWS: Array<{ kind: AmbientView; label: string }> = [
    { kind: "editor", label: "Ambient – editor" },
    { kind: "show", label: "Ambient – show window" },
];

const AMBIENT_PRESETS: Array<{ value: AmbientPreset; label: string }> = [
    { value: "dark", label: "Dark" },
    { value: "house", label: "House lights" },
    { value: "daylight", label: "Daylight" },
];

const store = useScene();
const popover = ref<InstanceType<typeof Popover>>();

const environment = computed(() => store.scene.environment);

/** The scene stores haze as 0..1; the UI shows 0–100 %. */
const hazePercent = computed({
    get: () => Math.round(environment.value.haze * 100),
    set: (value: number | null) => {
        if (value === null || Number.isNaN(value)) return;
        const clamped = Math.min(100, Math.max(0, value));
        store.setEnvironment({ haze: clamped / 100 }, "haze");
    },
});

function setHazerCoupling(value: boolean | undefined) {
    store.setEnvironment({ hazerCoupling: value === true });
}

/** One coalesced undo step per view and drag ("ambient-editor" / "ambient-show"). */
function setAmbient(view: AmbientView, patch: Partial<AmbientSetting>) {
    store.setEnvironment({ ambient: { [view]: patch } }, `ambient-${view}`);
}

/** The scene stores the brightness as 0..2; the slider shows 0–200 %. */
function setBrightness(view: AmbientView, value: number | number[]) {
    const percent = Array.isArray(value) ? value[0] : value;
    if (percent === undefined || !Number.isFinite(percent)) return;
    setAmbient(view, { brightness: Math.min(200, Math.max(0, percent)) / 100 });
}
</script>

<style scoped>
.environment-menu {
    display: inline-flex;
}

.environment-panel {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: 20rem;
}

.field-label {
    font-size: 0.875rem;
    opacity: 0.85;
}

.haze-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.haze-slider {
    flex: 1;
}

.haze-input {
    width: 6.5rem;
}

.haze-input :deep(input) {
    width: 100%;
}

.ambient-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.ambient-select {
    width: 8.5rem;
}

.ambient-slider {
    flex: 1;
}

.ambient-value {
    width: 3.5rem;
    text-align: right;
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
}

.checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.hint {
    font-size: 0.8rem;
    opacity: 0.7;
}
</style>
