import type { Group, Object3DEventMap } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export type ModelType = "MovingHead";

const MODEL_FILES: Record<ModelType, string> = {
    MovingHead: "moving_head_lowpoly.glb",
} as const;

class ModelLibrary {
    private readonly models = new Map<ModelType, Group<Object3DEventMap>>();

    public async initialize(): Promise<void> {
        for (const modelType of Object.keys(MODEL_FILES) as ModelType[]) {
            try {
                this.models.set(modelType, await this.loadModel(MODEL_FILES[modelType]));
            } catch (err) {
                console.error(`Failed to load model for ${modelType}`, err);
            }
        }
    }

    public getModel(modelType: ModelType): Group<Object3DEventMap> {
        const model = this.models.get(modelType);
        if (!model) {
            throw new Error(`Model for ${modelType} not loaded`);
        }
        return model;
    }

    private async loadModel(file: string): Promise<any> {
        const modelData = await (await fetch(`3d-models/${file}`)).arrayBuffer();
        const loader = new GLTFLoader();
        const model = await loader.parseAsync(modelData, "");
        return model.scene;
    }
}

export const modelLibrary = new ModelLibrary();
