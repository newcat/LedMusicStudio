import { Color, mix } from "@/graph/colors";
import { clamp } from "./clamp";

export function scaleColorArray(colors: Color[], targetSize: number): Color[] {
    const output: Color[] = [];
    for (let i = 0; i < targetSize; i++) {
        const originalIndex = (i / targetSize) * colors.length;
        const lowerIndex = clamp(Math.floor(originalIndex), 0, colors.length - 1);
        const upperIndex = clamp(Math.ceil(originalIndex), 0, colors.length - 1);
        if (lowerIndex === upperIndex) {
            output.push(colors[lowerIndex]);
        } else {
            const factor = originalIndex - lowerIndex;
            output.push(mix(colors[lowerIndex], colors[upperIndex], factor));
        }
    }
    return output;
}
