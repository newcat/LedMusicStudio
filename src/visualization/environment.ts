import * as THREE from "three";

import type { AmbientSetting, SceneEnvironment } from "@/scene/model/types";
import { hexToLinear, kelvinToRgb } from "./capabilities/colorMath";
import type { ViewKind } from "./quality";

/** Defaults of the scene environment (data-model §4). Clone before storing it anywhere. */
export const DEFAULT_ENVIRONMENT: SceneEnvironment = {
    haze: 0.3,
    hazerCoupling: false,
    ambient: {
        editor: { preset: "house", brightness: 1 },
        show: { preset: "dark", brightness: 1 },
    },
};

/** Per-view state of the environment (research R13): the project settings plus the effective haze. */
export class EnvironmentState {
    private current: SceneEnvironment = structuredClone(DEFAULT_ENVIRONMENT);
    private readonly hazeOutputs = new Map<string, number>();

    public get settings(): SceneEnvironment {
        return this.current;
    }

    /** Effective haze for this frame. Hazer coupling is added in US5; until then it is the project haze. */
    public get haze(): number {
        return this.current.haze;
    }

    public setSettings(environment: SceneEnvironment) {
        this.current = environment;
    }

    /** Fog renderers report their output each frame (0..1 × contribution). Not used until hazer coupling (US5). */
    public reportHazeOutput(objectId: string, amount: number) {
        this.hazeOutputs.set(objectId, amount);
    }

    public ambientFor(kind: ViewKind): AmbientSetting {
        return this.current.ambient[kind];
    }
}

const DAYLIGHT_GROUND = hexToLinear("#808080");

/** Hemisphere light of an ambient preset (data-model §4). */
export function ambientLight(setting: AmbientSetting): { sky: THREE.Color; ground: THREE.Color; intensity: number } {
    const brightness = Number.isFinite(setting.brightness) ? Math.max(0, setting.brightness) : 1;
    switch (setting.preset) {
        case "house": {
            const sky = kelvinToRgb(2700);
            return { sky, ground: sky.clone().multiplyScalar(0.5), intensity: 0.15 * brightness };
        }
        case "daylight":
            return { sky: kelvinToRgb(6500), ground: DAYLIGHT_GROUND.clone(), intensity: 1.2 * brightness };
        case "dark":
        default:
            return { sky: new THREE.Color(0, 0, 0), ground: new THREE.Color(0, 0, 0), intensity: 0 };
    }
}
