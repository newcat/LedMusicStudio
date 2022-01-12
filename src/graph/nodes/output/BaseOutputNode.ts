import { Node } from "@baklavajs/core";
import { globalState } from "@/globalState";
import { OutputLibraryItem, OutputType } from "@/output";
import { LibraryItemType } from "@/library";
import { watchEffect } from "vue";
import { SelectInterface } from "@baklavajs/renderer-vue";

export interface BaseOutputNodeInputs {
    output: string;
}

export interface BaseOutputNodeOutputs<T> {
    outputId: string | undefined;
    data: T | undefined;
}

export abstract class BaseOutputNode<T, I extends BaseOutputNodeInputs, O extends BaseOutputNodeOutputs<T>> extends Node<I, O> {
    private unwatch?: () => void;

    public constructor(private compatibleOutputTypes: OutputType[]) {
        super();
    }

    public override onPlaced() {
        this.unwatch = watchEffect(() => this.updateOutputs());
    }

    public destroy() {
        this.unwatch?.();
    }

    protected afterCalculate(inputs: I, data: T): BaseOutputNodeOutputs<T> {
        const { output } = inputs;
        if (output) {
            return { outputId: output, data };
        } else {
            return { outputId: undefined, data: undefined };
        }
    }

    private updateOutputs() {
        const optionItems: Array<{ text: string; value: string }> = [];
        for (const item of globalState.library.items) {
            if (
                item?.type === LibraryItemType.OUTPUT &&
                this.compatibleOutputTypes.includes((item as OutputLibraryItem).outputInstance?.type)
            ) {
                optionItems.push({ text: item.name, value: item.id });
            }
        }
        const selectOutputIntf = this.inputs.output as SelectInterface;
        selectOutputIntf.items = optionItems;
        selectOutputIntf.events.updated.emit();
    }
}
