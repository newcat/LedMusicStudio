import { watchEffect } from "vue";
import { SelectInterface } from "@baklavajs/renderer-vue";
import { LibraryItemType, useLibrary } from "@/library";
import { OutputLibraryItem, OutputType } from "@/output";

export class SelectOutputInterface extends SelectInterface {
    private readonly library = useLibrary();
    private unwatch?: () => void;

    constructor(name: string, private compatibleOutputTypes: OutputType[]) {
        super(name, "", []);
        this.setPort(false);
        this.unwatch = watchEffect(() => this.updateOutputs());
    }

    public get selectedOutput(): OutputLibraryItem | undefined {
        if (!this.value) {
            return;
        }

        return this.library.items.find((it) => it.id === this.value) as OutputLibraryItem;
    }

    public destroy() {
        this.unwatch?.();
    }

    private updateOutputs() {
        const optionItems: Array<{ text: string; value: string }> = [];
        for (const item of this.library.items) {
            if (
                item?.type === LibraryItemType.OUTPUT &&
                this.compatibleOutputTypes.includes((item as OutputLibraryItem).outputInstance?.type)
            ) {
                optionItems.push({ text: item.name, value: item.id });
            }
        }
        this.items = optionItems;
        this.events.updated.emit();
    }
}
