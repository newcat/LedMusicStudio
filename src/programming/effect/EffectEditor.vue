<template>
    <div class="effect-editor">
        <div class="fields">
            <LabelledFormField label="Attribute">
                <Select :model-value="state.attribute" :options="EFFECT_ATTRIBUTES" option-label="label" option-value="value" @update:model-value="setAttribute" />
            </LabelledFormField>
            <LabelledFormField label="Shape">
                <Select v-model="state.shape" :options="shapes" option-label="label" option-value="value" />
            </LabelledFormField>
            <LabelledFormField v-if="state.attribute !== 'color'" label="Mode">
                <SelectButton v-model="state.mode" :options="MODES" option-label="label" option-value="value" :allow-empty="false" />
            </LabelledFormField>

            <template v-if="state.attribute === 'color'">
                <LabelledFormField label="Color A">
                    <ColorPicker :model-value="hex(0)" format="hex" @update:model-value="setColor(0, $event)" />
                </LabelledFormField>
                <LabelledFormField label="Color B">
                    <ColorPicker :model-value="hex(1)" format="hex" @update:model-value="setColor(1, $event)" />
                </LabelledFormField>
            </template>
            <template v-else-if="isPair">
                <LabelledFormField label="Size pan / tilt">
                    <div class="flex gap-2">
                        <InputNumber v-model="pairSize[0]" suffix=" °" :max-fraction-digits="1" size="small" input-class="w-20" />
                        <InputNumber v-model="pairSize[1]" suffix=" °" :max-fraction-digits="1" size="small" input-class="w-20" />
                    </div>
                </LabelledFormField>
                <LabelledFormField v-if="state.mode === 'absolute'" label="Base pan / tilt">
                    <div class="flex gap-2">
                        <InputNumber v-model="pairBase[0]" suffix=" °" :max-fraction-digits="1" size="small" input-class="w-20" />
                        <InputNumber v-model="pairBase[1]" suffix=" °" :max-fraction-digits="1" size="small" input-class="w-20" />
                    </div>
                </LabelledFormField>
            </template>
            <template v-else>
                <LabelledFormField :label="isDegrees ? 'Size' : 'Size (swing)'">
                    <InputNumber v-model="singleSize" :suffix="isDegrees ? ' °' : ''" :min="isDegrees ? undefined : 0" :max="isDegrees ? undefined : 1" :max-fraction-digits="isDegrees ? 1 : 3" :step="isDegrees ? 1 : 0.05" show-buttons size="small" input-class="w-24" />
                </LabelledFormField>
                <LabelledFormField v-if="state.mode === 'absolute'" label="Base">
                    <InputNumber v-model="singleBase" :suffix="isDegrees ? ' °' : ''" :max-fraction-digits="isDegrees ? 1 : 3" :step="isDegrees ? 1 : 0.05" show-buttons size="small" input-class="w-24" />
                </LabelledFormField>
            </template>

            <LabelledFormField label="Rate (beats per cycle)">
                <InputNumber v-model="rateBeats" :min="0.0625" :max-fraction-digits="3" :step="0.25" show-buttons size="small" input-class="w-24" />
            </LabelledFormField>
            <LabelledFormField label="Phase spread">
                <InputNumber v-model="spread" :min="0" :max="720" suffix=" °" show-buttons :step="45" size="small" input-class="w-24" />
            </LabelledFormField>
            <LabelledFormField v-if="!isPairShape" label="Width (duty cycle)">
                <InputNumber v-model="widthPercent" :min="1" :max="100" suffix=" %" show-buttons :step="5" size="small" input-class="w-24" />
            </LabelledFormField>
            <LabelledFormField label="Wings">
                <InputNumber v-model="wings" :min="1" show-buttons size="small" input-class="w-20" />
            </LabelledFormField>
            <LabelledFormField label="Blocks">
                <InputNumber v-model="blocks" :min="1" show-buttons size="small" input-class="w-20" />
            </LabelledFormField>
            <LabelledFormField label="Interleave">
                <InputNumber v-model="interleave" :min="1" show-buttons size="small" input-class="w-20" />
            </LabelledFormField>
            <LabelledFormField label="Direction">
                <SelectButton v-model="state.direction" :options="DIRECTIONS" option-label="label" option-value="value" :allow-empty="false" />
            </LabelledFormField>
        </div>

        <div class="preview">
            <div class="mb-2 text-sm opacity-70">
                Phase preview
                <template v-if="fixtures.length > 0">({{ fixtures.length }} fixtures of the selected clip's target)</template>
                <template v-else>(8 sample fixtures: place the effect on the timeline and give it a target)</template>
            </div>
            <div class="strip">
                <div v-for="(dot, i) in dots" :key="i" class="slot">
                    <div class="dot" :style="dot"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import ColorPicker from "primevue/colorpicker";
import InputNumber from "primevue/inputnumber";
import Select from "primevue/select";
import SelectButton from "primevue/selectbutton";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { useGlobalState } from "@/globalState";
import type { Rgb } from "../attributes";
import { hexToRgb, lerpColor, rgbToHex } from "../color";
import { useItemTargetFixtures } from "../editorContext";
import { evaluateShape, phaseOffset } from "../effects";
import { EFFECT_ATTRIBUTES, EFFECT_SHAPES, effectSizeDefaults, type EffectAttribute } from "../states";
import type { EffectLibraryItem } from "./Effect.libraryItem";

const MODES = [
    { label: "Relative", value: "relative" },
    { label: "Absolute", value: "absolute" },
];
const DIRECTIONS = [
    { label: "Forward", value: "forward" },
    { label: "Backward", value: "backward" },
];

const props = defineProps<{ effect: EffectLibraryItem }>();

const globalState = useGlobalState();
const state = computed(() => props.effect.state);
const isPair = computed(() => state.value.attribute === "panTilt");
const isDegrees = computed(() => state.value.attribute === "pan" || state.value.attribute === "tilt");
const shapes = computed(() => EFFECT_SHAPES.filter((s) => !s.panTiltOnly || isPair.value));

function setAttribute(attribute: EffectAttribute) {
    const s = state.value;
    s.attribute = attribute;
    Object.assign(s, effectSizeDefaults(attribute));
    if ((s.shape === "circle" || s.shape === "figure8") && attribute !== "panTilt") {
        s.shape = "sine";
    }
    if (attribute === "color") {
        s.mode = "absolute";
    }
}

function numberModel(get: () => number, set: (v: number) => void) {
    return computed({ get, set: (v: number | null) => set(v ?? 0) });
}

const singleSize = numberModel(
    () => (Array.isArray(state.value.size) ? state.value.size[0] : state.value.size),
    (v) => (state.value.size = v)
);
const singleBase = numberModel(
    () => (Array.isArray(state.value.base) ? state.value.base[0] : state.value.base),
    (v) => (state.value.base = v)
);
// panTilt always stores pairs (sanitizeEffectState, setAttribute)
const pairSize = computed(() => state.value.size as [number, number]);
const pairBase = computed(() => state.value.base as [number, number]);
const rateBeats = numberModel(
    () => state.value.rateBeats,
    (v) => (state.value.rateBeats = v > 0 ? v : 1)
);
const spread = numberModel(
    () => state.value.spread,
    (v) => (state.value.spread = Math.min(720, Math.max(0, v)))
);
const widthPercent = numberModel(
    () => Math.round(state.value.width * 1000) / 10,
    (v) => (state.value.width = Math.min(1, Math.max(0.01, v / 100)))
);
const isPairShape = computed(() => state.value.shape === "circle" || state.value.shape === "figure8");
const intModel =(key: "wings" | "blocks" | "interleave") =>
    numberModel(
        () => state.value[key],
        (v) => (state.value[key] = Math.max(1, Math.round(v)))
    );
const wings = intModel("wings");
const blocks = intModel("blocks");
const interleave = intModel("interleave");

function hex(i: 0 | 1): string {
    return rgbToHex(state.value.colors[i]).slice(1);
}

function setColor(i: 0 | 1, value: string | object) {
    const rgb = typeof value === "string" ? hexToRgb(value) : null;
    if (rgb) {
        state.value.colors[i] = rgb;
    }
}

// --- phase preview -----------------------------------------------------------------------------------------------

const fixtures = useItemTargetFixtures(() => props.effect);
const count = computed(() => (fixtures.value.length > 0 ? fixtures.value.length : 8));
const time = ref(0);
let frame = 0;
let started = 0;

onMounted(() => {
    started = performance.now();
    const tick = () => {
        time.value = (performance.now() - started) / 1000;
        frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
});
onBeforeUnmount(() => cancelAnimationFrame(frame));

const dots = computed(() => {
    const s = state.value;
    const beats = (time.value * globalState.bpm) / 60;
    const n = count.value;
    const result: Array<Record<string, string>> = [];
    for (let i = 0; i < n; i++) {
        const offset = phaseOffset(i, n, s.spread, s.wings, s.blocks, s.interleave, s.direction === "backward");
        const raw = evaluateShape(s.shape, beats / s.rateBeats + offset / 360, s.width);
        const [a, b] = Array.isArray(raw) ? raw : [raw, raw];
        const style: Record<string, string> = {};
        if (s.attribute === "color") {
            style.background = rgbToHex(lerpColor(s.colors[0], s.colors[1], (a + 1) / 2) as Rgb);
        } else if (s.attribute === "panTilt") {
            style.transform = `translate(${a * 10}px, ${-b * 10}px)`;
        } else if (s.attribute === "pan") {
            style.transform = `translateX(${a * 10}px)`;
        } else if (s.attribute === "tilt") {
            style.transform = `translateY(${-a * 10}px)`;
        } else {
            style.opacity = String(0.1 + 0.9 * ((a + 1) / 2));
        }
        result.push(style);
    }
    return result;
});
</script>

<style scoped>
.effect-editor {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem;
    width: 100%;
    overflow: auto;
}
.fields {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 1rem;
    align-items: start;
}
.strip {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}
.slot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px dashed var(--p-content-border-color);
    display: flex;
    align-items: center;
    justify-content: center;
}
.dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--p-primary-color);
}
</style>
