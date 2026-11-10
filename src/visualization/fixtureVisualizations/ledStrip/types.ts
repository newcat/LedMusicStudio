/** Config of the LED strip visualization (feature 003, contracts/scene-state-delta.ts). */

type Vec3 = [number, number, number];

export interface StripPathPoint {
    /** Object-local position, meters. */
    position: Vec3;
    /** Emission direction (surface normal at the click), object-local unit vector. */
    normal: Vec3;
}

export interface StripPath {
    /** At least 2 points. */
    points: StripPathPoint[];
    interpolation: "linear" | "curve";
    closed: boolean;
}

/** LED_STRIP (start/end replaced by path; converted on load). */
export interface LedStripVisualizationConfig {
    /** 0..1 */
    intensity: number;
    path: StripPath;
    /** Pixel size relative to the pitch, 0.2..1, default 0.6. */
    pixelSize: number;
}

/** Default path (data-model §2): two points (−0.5, 0, 0) and (0.5, 0, 0), normals +Y, linear, open. */
export function defaultStripPath(): StripPath {
    return {
        points: [
            { position: [-0.5, 0, 0], normal: [0, 1, 0] },
            { position: [0.5, 0, 0], normal: [0, 1, 0] },
        ],
        interpolation: "linear",
        closed: false,
    };
}
