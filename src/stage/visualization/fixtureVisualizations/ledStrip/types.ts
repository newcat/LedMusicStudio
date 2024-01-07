export interface LedStripVisualizationConfig {
    intensity: number;
    start: [number, number, number];
    end: [number, number, number];
}

export interface LedStripRendererConfig extends LedStripVisualizationConfig {
    numLeds: number;
}
