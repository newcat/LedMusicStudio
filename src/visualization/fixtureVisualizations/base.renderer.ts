import * as THREE from "three";

export interface RendererInputs {
    camera: THREE.Camera;
}

export abstract class BaseRenderer<C = unknown, V = unknown> extends THREE.Group {
    public constructor(protected readonly inputs: RendererInputs) {
        super();
    }
    public abstract onConfigUpdate(c: C): void;
    public abstract onFixtureValueUpdate(v: V): void;
    /** @virtual */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public dispose() {}
}
