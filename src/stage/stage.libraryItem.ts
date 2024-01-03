import { markRaw } from "vue";
import { serialize, deserialize } from "bson";
import { LibraryItem, LibraryItemType } from "@/library";
import { StageScene } from "./stageScene";
import { BaseStageFixture, LedStripStageFixture, StageFixtureType } from "./fixtures";

interface FixtureState {
    type: StageFixtureType;
    id: string;
    name: string;
    outputId: string;
    state: any;
}

interface StageLibraryItemState {
    id: string;
    name: string;
    baseScene: any | null;
    fixtures: FixtureState[];
}

export class StageLibraryItem extends LibraryItem {
    public type = LibraryItemType.STAGE;
    public name = "Stage";

    private _scene: StageScene | null = null;
    private _fixtures: BaseStageFixture[] = [];

    public get scene() {
        return this._scene;
    }

    public get fixtures() {
        return this._fixtures;
    }

    public serialize() {
        return serialize({
            id: this.id,
            name: this.name,
            baseScene: this.scene?.baseScene ?? null,
            fixtures: this.fixtures.map((fixture) => ({
                type: fixture.type,
                id: fixture.id,
                name: fixture.name,
                outputId: fixture.outputId,
                state: fixture.saveState(),
            })),
        } satisfies StageLibraryItemState);
    }

    public deserialize(buffer: Buffer): void {
        const { id, name, baseScene, fixtures } = deserialize(buffer) as StageLibraryItemState;
        this.id = id;
        this.name = name;
        this._fixtures = fixtures.map((f) => {
            const fixture = this.createFixture(f.type);
            fixture.id = f.id;
            fixture.name = f.name;
            fixture.outputId = f.outputId;
            fixture.loadState(f.state);
            return fixture;
        });
        this.createScene(baseScene);
    }

    public onOutputData(outputId: string, data: any) {
        this.scene?.outputData.set(outputId, data);
    }

    public createScene(baseScene: any) {
        this._scene = markRaw(new StageScene(baseScene));
        this._scene.applyFixtures(this.fixtures);
    }

    public applyFixtures(fixtures: BaseStageFixture[]) {
        this._fixtures = fixtures;
        this.scene?.applyFixtures(this.fixtures);
    }

    private createFixture(type: StageFixtureType): BaseStageFixture {
        switch (type) {
            case StageFixtureType.LED_STRIP:
                return new LedStripStageFixture();
            default:
                throw new Error(`Unknown fixture type ${type}`);
        }
    }
}
