import * as THREE from "three";

export abstract class BaseVisualization extends THREE.Group {
    public abstract updateData(outputData: Map<string, any>): void;
    public dispose() {}
}
