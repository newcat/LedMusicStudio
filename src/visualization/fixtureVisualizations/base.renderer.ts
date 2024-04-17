import * as THREE from "three";

export abstract class BaseRenderer<C = unknown, V = unknown> extends THREE.Group {
    public abstract onConfigUpdate(c: C): void;
    public abstract onFixtureValueUpdate(v: V): void;
    public dispose() {}
}
