import { computed, Ref } from "vue";
import { TICKS_PER_BEAT } from "@/constants";

export interface IMarker {
    type: "major" | "minor";
    unit: number;
    position: number;
}

export function useTimelineBackground(unitWidth: Ref<number>, maxUnit: Ref<number>) {
    const markerSpacing = computed(() => {
        if (unitWidth.value < 0.25) {
            return { space: TICKS_PER_BEAT * 16, majorMultiplier: 1 };
        } else if (unitWidth.value > 2) {
            return { space: TICKS_PER_BEAT, majorMultiplier: 4 };
        } else {
            return { space: TICKS_PER_BEAT * 4, majorMultiplier: 4 };
        }
    });

    const markers = computed(() => {
        if (unitWidth.value <= 0) {
            return [];
        }
        const markers: IMarker[] = [];

        for (let unit = markerSpacing.value.space; unit < maxUnit.value; unit += markerSpacing.value.space) {
            const x = unit * unitWidth.value;
            const nthMarker = Math.floor(unit / markerSpacing.value.space);
            if (nthMarker % markerSpacing.value.majorMultiplier === 0) {
                markers.push({ type: "major", unit, position: x });
            } else {
                markers.push({ type: "minor", unit, position: x });
            }
        }
        return markers;
    });

    const styles = computed(() => {
        const baseBgSize = markerSpacing.value.space * unitWidth.value;
        return {
            backgroundSize: `${4 * baseBgSize}px ${4 * baseBgSize}px, ${baseBgSize}px ${baseBgSize}px`,
            backgroundImage: `linear-gradient(90deg, var(--p-form-field-disabled-background) 1px, transparent 1px),
        linear-gradient(90deg, var(--p-form-field-filled-background) 1px, transparent 1px)`,
            backgroundRepeat: "repeat",
        };
    });

    return { markerSpacing, markers, styles };
}
