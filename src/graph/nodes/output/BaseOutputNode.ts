import { Node } from "@baklavajs/core";
import { observe, unobserve } from "@nx-js/observer-util";
import { globalState } from "@/globalState";
import { OutputLibraryItem, OutputType } from "@/output";
import { LibraryItemType } from "@/library";

export abstract class BaseOutputNode extends Node {
    public abstract type: string;
    public abstract name: string;

    private reaction: () => void;

    public constructor(private compatibleOutputTypes: OutputType[]) {
        super();
        this.addOption("Output", "SelectOption", "", undefined, { items: [] });
        this.reaction = observe(() => this.updateOutputs());
        globalState.library.events.loaded.addListener(this, () => this.reaction());
    }

    public destroy() {
        unobserve(this.reaction);
        globalState.library.events.loaded.removeListener(this);
    }

    protected afterCalculate(data: any) {
        const id = this.getOptionValue("Output");
        if (id) {
            return { id, data };
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
        const outputOption = this.options.get("Output")!;
        outputOption.items = optionItems;
        outputOption.events.updated.emit();
    }
}
