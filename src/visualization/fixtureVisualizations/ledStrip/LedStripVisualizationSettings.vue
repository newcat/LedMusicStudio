<template>
    <PropertyRow label="Path" :hint="pixelInfo">
        <div class="path-row">
            <span class="path-info">{{ pathInfo }}</span>
            <template v-if="tool && objectId">
                <Button
                    v-tooltip.bottom="'Draw path'"
                    size="small"
                    icon="mdi mdi-draw"
                    aria-label="Draw path"
                    :outlined="activeMode !== 'drawing'"
                    @click="toggle('drawing')"
                />
                <Button
                    v-tooltip.bottom="'Edit path'"
                    size="small"
                    icon="mdi mdi-vector-polyline-edit"
                    aria-label="Edit path"
                    :outlined="activeMode !== 'editing'"
                    @click="toggle('editing')"
                />
            </template>
        </div>
    </PropertyRow>
    <PropertyRow label="Interpolation">
        <Select v-model="interpolation" :options="INTERPOLATION_OPTIONS" option-label="label" option-value="value" size="small" fluid />
    </PropertyRow>
    <PropertyRow label="Closed loop" for="led-strip-closed">
        <div class="checkbox-row">
            <Checkbox v-model="closed" input-id="led-strip-closed" binary />
        </div>
    </PropertyRow>
    <PropertyRow label="Pixel size">
        <SliderField v-model="config.pixelSize" :min="0.2" :max="1" :step="0.05" />
    </PropertyRow>
    <PropertyRow label="Intensity">
        <SliderField v-model="config.intensity" :min="0" :max="1" :step="0.01" />
    </PropertyRow>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Select from "primevue/select";

import PropertyRow from "@/scene/editor/inspector/PropertyRow.vue";
import SliderField from "@/scene/editor/inspector/SliderField.vue";
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
        return `${linked} pixels, ${perMeter} per metre`;
    }
    return `${unlinkedPixelCount(length.value)} pixels (30 per metre)`;
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
.path-row {
    display: flex;
    align-items: center;
    gap: var(--insp-gap-1, 4px);
    min-width: 0;
}

.path-info {
    flex: 1;
    min-width: 0;
    font-size: 0.8125rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.checkbox-row {
    display: flex;
    align-items: center;
    min-height: 2rem;
}
</style>
