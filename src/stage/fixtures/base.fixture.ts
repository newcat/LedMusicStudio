import { OutputType } from "@/output";
import { v4 as uuidv4 } from "uuid";
import * as THREE from "three";
import { ThreeBaseFixture } from "./base.three";

export enum StageFixtureType {
    LED_STRIP = "Led Strip",
}

export abstract class BaseStageFixture {
    public abstract readonly settingsComponent?: any;
    public abstract readonly compatibleOutputTypes: OutputType[];

    public type: StageFixtureType;
    public name: string;
    public id: string = uuidv4();
    public outputId: string = "";

    public abstract get isValid(): boolean;

    public constructor(type: StageFixtureType, name: string) {
        this.type = type;
        this.name = name;
    }

    public abstract createThreeInstance(scene: THREE.Scene): ThreeBaseFixture;
}
