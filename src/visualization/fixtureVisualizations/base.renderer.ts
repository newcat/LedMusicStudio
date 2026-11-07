import * as THREE from "three";

import type { LedStripLighting } from "../ledLitMaterial";

export interface RendererInputs {
    camera: THREE.Camera;
    lighting: LedStripLighting;
}

/**
 * Renderer of one fixture visualization. It draws at the local origin of its parent: placement comes from the
 * scene object's transform, never from the config.
 */
export abstract class BaseRenderer<C = unknown, V = unknown> extends THREE.Group {
    public constructor(protected readonly inputs: RendererInputs) {
        super();
    }
    public abstract onConfigUpdate(c: C): void;
    public abstract onFixtureValueUpdate(v: V): void;

    /**
     * Editor-only helper geometry for fixtures without a pickable body (it is put on the editor layer by the view).
     * @virtual
     */
    public createEditorProxy(): THREE.Object3D | null {
        return null;
    }

    /**
     * Called once per frame after the scene graph's world matrices are up to date.
     * @virtual
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public updateWorld(): void {}

    /**
     * Renderers with a real SpotLight return it, so the view can cap the number of real lights (research R15).
     * @virtual
     */
    public getSurfaceLight(): THREE.Light | null {
        return null;
    }

    /** @virtual */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public dispose() {}
}
