import { serialize, deserialize } from "bson";
import * as THREE from "three";
import { LibraryItem, LibraryItemType } from "@/library";
import { StageScene } from "./stageScene";
import { BaseStageFixture } from "./fixtures";

export class StageLibraryItem extends LibraryItem {
    public type = LibraryItemType.STAGE;
    public name = "Stage";

    public scene: StageScene | null = null;
    public fixtures: BaseStageFixture[] = [];

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
        this.scene?.outputData.set(outputId, data);
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
