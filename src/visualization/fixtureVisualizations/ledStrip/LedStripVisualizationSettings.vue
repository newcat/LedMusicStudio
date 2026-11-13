<template>
    <div class="led-strip-settings">
        <LabelledFormField label="Path">
            <div class="path-row">
                <span>{{ pathInfo }}</span>
                <div v-if="tool && objectId" class="path-buttons">
                    <Button
                        size="small"
                        icon="mdi mdi-draw"
                        label="Draw path"
                        :outlined="activeMode !== 'drawing'"
                        @click="toggle('drawing')"
                    />
                    <Button
                        size="small"
                        icon="mdi mdi-vector-polyline-edit"
                        label="Edit path"
                        :outlined="activeMode !== 'editing'"
                        @click="toggle('editing')"
                    />
                </div>
            </div>
        </LabelledFormField>

        <div class="row">
            <LabelledFormField label="Interpolation">
                <Select v-model="interpolation" :options="INTERPOLATION_OPTIONS" option-label="label" option-value="value" />
            </LabelledFormField>
            <div class="closed">
                <Checkbox v-model="closed" input-id="led-strip-closed" binary />
                <label for="led-strip-closed">Closed loop</label>
            </div>
        </div>

        <LabelledFormField :label="`Pixel size (${config.pixelSize.toFixed(2)})`">
            <Slider v-model="config.pixelSize" :min="0.2" :max="1" :step="0.05" class="slider" />
        </LabelledFormField>
        <LabelledFormField :label="`Intensity (${Math.round(config.intensity * 100)} %)`">
            <Slider v-model="config.intensity" :min="0" :max="1" :step="0.01" class="slider" />
        </LabelledFormField>

        <div class="hint">{{ pixelInfo }}</div>
    </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Select from "primevue/select";
import Slider from "primevue/slider";

import LabelledFormField from "@/components/LabelledFormField.vue";
import type { LedStripFixture } from "@/stage/fixtures";
import type { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import { useLiveConfig } from "../useLiveConfig";
import { StripPathSampler, unlinkedPixelCount } from "./stripPath";
import { STRIP_PATH_TOOL_KEY, type StripPathToolApi, type StripPathToolMode } from "./stripPathToolApi";
import type { LedStripVisualizationConfig, StripPath } from "./types";

defineOptions({ inheritAttrs: false });

const INTERPOLATION_OPTIONS = [
    { label: "Straight segments", value: "linear" },
    { label: "Smooth curve", value: "curve" },
];

const props = defineProps<{
    /** Id of the visualization object; the path tool and `setStripPath` need it. */
    objectId?: string;
    /** Set when the strip is linked to a fixture. */
    controller?: FixtureVisualizationController<LedStripFixture>;
}>();

const model = defineModel<LedStripVisualizationConfig>("config", { required: true });
const config = useLiveConfig(model, (value) => (model.value = value));

/** Provided by the scene editor; not available in the fixture settings. */
const tool = inject<StripPathToolApi | null>(STRIP_PATH_TOOL_KEY, null);

const activeMode = computed<StripPathToolMode | null>(() => {
    const state = tool?.state.value;
    return state && state.objectId === props.objectId ? state.mode : null;
});

function toggle(mode: StripPathToolMode) {
    if (!tool || !props.objectId) {
        return;
    }
    if (activeMode.value === mode) {
        tool.stop();
    } else if (mode === "drawing") {
        tool.draw(props.objectId);
    } else {
        tool.edit(props.objectId);
    }
}

const length = computed(() => {
    const path = model.value.path;
    if (!path || path.points.length < 2) {
        return 0;
    }
    try {
        return new StripPathSampler(path).length;
    } catch {
        return 0;
    }
});

const pathInfo = computed(() => `${model.value.path?.points.length ?? 0} points · ${length.value.toFixed(2)} m`);

const pixelInfo = computed(() => {
    const linked = props.controller?.fixture.config.numLeds;
    if (linked !== undefined) {
        const perMeter = length.value > 0 ? Math.round(linked / length.value) : 0;
        return `${linked} pixels, ${perMeter} per meter`;
    }
    return `${unlinkedPixelCount(length.value)} pixels (not linked: 30 per meter)`;
});

/** Path changes go through `setStripPath` (one undo step); without the editor, through the config. */
function updatePath(patch: Partial<Pick<StripPath, "interpolation" | "closed">>) {
    const path: StripPath = { ...(JSON.parse(JSON.stringify(model.value.path)) as StripPath), ...patch };
    if (tool && props.objectId) {
        tool.setPath(props.objectId, path);
    } else {
        config.value.path = path;
    }
}

const interpolation = computed({
    get: () => model.value.path.interpolation,
    set: (value: StripPath["interpolation"]) => updatePath({ interpolation: value }),
});

const closed = computed({
    get: () => model.value.path.closed,
    set: (value: boolean) => updatePath({ closed: value }),
});
</script>

<style scoped>
.led-strip-settings {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.path-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}

.path-buttons {
    display: flex;
    gap: 0.35rem;
}

.row {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
}

.closed {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-bottom: 0.5rem;
}

.slider {
    margin: 0.75rem 0.5rem;
}

.hint {
    font-size: 0.85rem;
    opacity: 0.7;
}
</style>
