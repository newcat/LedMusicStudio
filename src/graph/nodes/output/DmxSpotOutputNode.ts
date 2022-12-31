import { watch } from "vue";
import { NodeInterface, SelectInterface, defineDynamicNode, DynamicNodeDefinition, IAdvancedSelectInterfaceItem } from "baklavajs";
import { IntegerInterface } from "@/graph/interfaces";
import { SelectOutputInterface } from "@/graph/interfaces/SelectOutputInterface";
import { useLibrary } from "@/library";
import { OutputLibraryItem, OutputType } from "@/output";
import type { DmxOutput, IDmxOutputData } from "@/output/dmx/dmx.output";

class SelectFixtureInterface extends SelectInterface {
    private output: DmxOutput | undefined;
    private unwatch?: () => void;

    public get selectedFixture() {
        if (!this.output || !this.value) {
            return;
        }

        return this.output.fixtures.find((f) => f.id === this.value);
    }

    public updateOutput(output: DmxOutput | undefined) {
        this.output = output;
        this.unwatch?.();

        if (!output) {
            this.setItems([]);
            return;
        }

        watch(
            output,
            () => {
                this.updateFixtures();
            },
            { deep: true, immediate: true }
        );
    }

    private updateFixtures() {
        if (this.output) {
            this.setItems(this.output.fixtures.map((f) => ({ text: `${f.name} (${f.startChannel})`, value: f.id })));
        } else {
            this.setItems([]);
        }
        this.events.setValue.emit(this.value);
    }

    private setItems(items: Array<IAdvancedSelectInterfaceItem<string>>) {
        this.items = items;
        if (!items.find((it) => it.value === this.value)) {
            this.value = "";
        }
    }
}

export const DmxOutputNode = defineDynamicNode({
    type: "Dmx Output",
    inputs: {
        output: () => new SelectOutputInterface("Output", [OutputType.DMX]),
        fixture: () => new SelectFixtureInterface("Fixture", "", []).setPort(false),
    },
    outputs: {
        outputId: () => new NodeInterface<string | undefined>("OutputId", undefined).setHidden(true),
        data: () => new NodeInterface<IDmxOutputData | undefined>("Data", undefined).setHidden(true),
    },
    onPlaced() {
        // can't use `this` here as it is already used by the node internally
        (this as any).token = Symbol();
        this.inputs.output.events.setValue.subscribe((this as any).token, () => {
            (this.inputs.fixture as SelectFixtureInterface).updateOutput(
                (this.inputs.output as SelectOutputInterface).selectedOutput?.outputInstance as DmxOutput
            );
        });
    },
    onUpdate({ output, fixture }) {
        if (!output || !fixture) {
            return {};
        }

        const library = useLibrary();
        const outputItem = library.items.find((it) => it.id === output)! as OutputLibraryItem;
        const dmxOutput = outputItem.outputInstance as DmxOutput;
        const fixtureInstance = dmxOutput.fixtures.find((f) => f.id === fixture)!;

        const inputs: DynamicNodeDefinition = {};
        for (const channel of fixtureInstance.mode.channels) {
            if (typeof channel === "string") {
                inputs[channel] = () => new IntegerInterface(channel, 0, 0, 255);
            }
        }

        return { inputs };
    },
    onDestroy() {
        this.inputs.output.events.updated.unsubscribe((this as any).token);
        (this.inputs.output as SelectOutputInterface).destroy();
    },
});
