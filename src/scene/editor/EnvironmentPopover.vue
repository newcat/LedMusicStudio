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
import Slider from "primevue/slider";

import { useScene } from "../sceneStore";

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
