import { NodeInterface } from "baklavajs";
import { useTimeline } from "@/timeline";
import { Color, mix } from "../colors";
import { GraphLibraryItem } from "../graph.libraryItem";

interface VALUE_TYPES {
    boolean: boolean;
    color_single: Color;
    color_array: Color[];
    number: number;
    unknown: unknown;
}

interface InterfaceKeyframes {
    valueType: keyof VALUE_TYPES;
    keyframes: Array<Keyframe>;
}

interface Keyframe {
    position: number;
    value: any;
}

interface NodeInterfaceWithType extends NodeInterface {
    type?: string;
}

type InterpolationFunction<V extends keyof VALUE_TYPES> = (a: VALUE_TYPES[V], b: VALUE_TYPES[V], f: number) => VALUE_TYPES[V];
const INTERPOLATION_FUNCTIONS: { [V in keyof VALUE_TYPES]: InterpolationFunction<V> } = {
    boolean: (a, b, f) => a,
    color_single: (a, b, f) => mix(a, b, f),
    color_array: (a, b, f) => {
        const length = Math.max(a.length, b.length);
        const result: Color[] = new Array(length);

        for (let i = 0; i < length; i++) {
            const aTmp = i < a.length ? a[i] : a[a.length - 1];
            const bTmp = i < b.length ? b[i] : b[b.length - 1];
            result[i] = mix(aTmp, bTmp, f);
        }

        return result;
    },
    number: (a, b, f) => a * (1.0 - f) + b * f,
    unknown: (a, b, f) => a,
};

export class KeyframeManager {
    public keyframes: Map<string, InterfaceKeyframes> = new Map();

    public constructor(private readonly item: GraphLibraryItem) {
        item.editor.editor.graphEvents.removeNode.subscribe(this, (node) => {
            // TODO: Remove all keyframes for all interfaces of this node
        });
    }

    public addKeyframe<T>(intf: NodeInterface, value: T): boolean {
        const timeline = useTimeline();
        const position = timeline.getPositionRelativeToItem(this.item);
        if (position < 0) {
            return false;
        }

        const keyframesForInterface = this.keyframes.get(intf.id)?.keyframes;
        if (keyframesForInterface) {
            const existingKeyframe = keyframesForInterface.find((k) => k.position === position);
            if (existingKeyframe) {
                existingKeyframe.value = value;
            } else {
                keyframesForInterface.push({ position, value });
            }
            keyframesForInterface.sort((a, b) => a.position - b.position);
        } else {
            const valueType = this.getTypeForNodeInterface(intf);
            this.keyframes.set(intf.id, {
                valueType,
                keyframes: [{ position, value }],
            });
        }

        return true;
    }

    public removeKeyframe(interfaceId: string): boolean {
        const timeline = useTimeline();
        const position = timeline.getPositionRelativeToItem(this.item);
        if (position < 0) {
            return false;
        }

        const keyframesForInterface = this.keyframes.get(interfaceId)?.keyframes;
        if (keyframesForInterface) {
            const existingKeyframeIndex = keyframesForInterface.findIndex((k) => k.position === position);
            if (existingKeyframeIndex >= 0) {
                keyframesForInterface.splice(existingKeyframeIndex, 1);
            }
            if (keyframesForInterface.length === 0) {
                this.keyframes.delete(interfaceId);
            }
        }
        return true;
    }

    public applyKeyframes(position: number) {
        for (const [interfaceId, interfaceKeyframes] of this.keyframes.entries()) {
            const value = this.getValueAtPosition(interfaceKeyframes, position);
            for (const graph of this.item.editor.editor.graphs) {
                const ni = graph.findNodeInterface(interfaceId);
                if (ni) {
                    ni.value = value;
                    break;
                }
            }
        }
    }

    private getValueAtPosition(interfaceKeyframes: InterfaceKeyframes, position: number) {
        const keyframes = interfaceKeyframes.keyframes;
        if (keyframes[0].position > position) {
            // we're before the first keyframe
            return keyframes[0].value;
        } else if (keyframes.at(-1)!.position < position) {
            // we're behind the last keyframe
            return keyframes.at(-1)!.value;
        } else {
            // find first keyframe that is larger than current position
            const nextKeyframeIndex = keyframes.findIndex((k) => k.position >= position);
            if (keyframes[nextKeyframeIndex].position === position) {
                return keyframes[nextKeyframeIndex].value;
            } else {
                // interpolate
                const nextKeyframe = keyframes[nextKeyframeIndex];
                const prevKeyframe = keyframes[nextKeyframeIndex - 1];
                const f = (position - prevKeyframe.position) / (nextKeyframe.position - prevKeyframe.position);
                const lerp =
                    interfaceKeyframes.valueType in INTERPOLATION_FUNCTIONS
                        ? (INTERPOLATION_FUNCTIONS[interfaceKeyframes.valueType] as InterpolationFunction<"unknown">)
                        : INTERPOLATION_FUNCTIONS["unknown"];
                return lerp(prevKeyframe.value, nextKeyframe.value, f);
            }
        }
    }

    private getTypeForNodeInterface(ni: NodeInterface): keyof VALUE_TYPES {
        return ((ni as NodeInterfaceWithType).type as keyof VALUE_TYPES) ?? "unknown";
    }
}
