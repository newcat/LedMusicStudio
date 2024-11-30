import { Node } from "baklavajs";
import { SelectFixtureInterface } from "@/graph/interfaces/SelectFixtureInterface";

export interface BaseOutputNodeInputs {
    fixtureId: string;
}

export interface BaseOutputNodeOutputs<T> {
    fixtureId: string;
    data: T;
}

export abstract class BaseOutputNode<T, I extends BaseOutputNodeInputs, O extends BaseOutputNodeOutputs<T>> extends Node<I, O> {
    public constructor() {
        super();
    }

    public override onDestroy() {
        (this.inputs.fixtureId as SelectFixtureInterface).destroy();
    }
}
