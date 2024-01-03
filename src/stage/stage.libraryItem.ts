import { markRaw } from "vue";
import { serialize, deserialize } from "bson";
import * as THREE from "three";
import { LibraryItem, LibraryItemType } from "@/library";
import { StageScene } from "./stageScene";

import testscene from "./testscene.json";

export class StageLibraryItem extends LibraryItem {
    public type = LibraryItemType.STAGE;
    public name = "Stage";

    public outputData: Map<string, any> = new Map();
    public scene = markRaw(new StageScene(testscene));

    public serialize() {
        return serialize({
            id: this.id,
            name: this.name,
        });
    }

    public deserialize(buffer: Buffer): void {
        const { id, name } = deserialize(buffer);
        this.id = id;
        this.name = name;
    }

    public onOutputData(outputId: string, data: any) {
        this.outputData.set(outputId, data);
    }

    public loadScene(sceneObject: any) {
        const loader = new THREE.ObjectLoader();
        const scene = loader.parse(sceneObject);

        const camera = scene.children.find((child) => child.type === "PerspectiveCamera") as THREE.PerspectiveCamera;
        if (!camera) {
            throw new Error("No camera found in scene");
        }
    }
}
