/** Config of the Generic Fixture visualization (feature 002, contracts/scene-state-delta.ts). */
export interface GenericVisualizationConfig {
    channelMapping: {
        /** 0..1 after mapping; unmapped = full (defaultValue 1). */
        intensity: { channel: number; defaultValue: number; min: number; max: number };
        /** DMX channel indices, -1 = not mapped; no color mapped = white. */
        red: number;
        green: number;
        blue: number;
        white: number;
    };
}
