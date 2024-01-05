import { NodeInterface, defineDynamicNode, DynamicNodeDefinition } from "baklavajs";
import { IntegerInterface } from "@/graph/interfaces";
import { SelectFixtureInterface } from "@/graph/interfaces/SelectFixtureInterface";
import { DmxFixture, FixtureType, useStage } from "@/stage";

class DmxChannelInterface extends IntegerInterface {
    public constructor(name: string) {
        super(name, 0, 0, 255);
    }
}

export const DmxOutputNode = defineDynamicNode({
    type: "Dmx Output",
    inputs: {
        fixtureId: () => new SelectFixtureInterface("Output", [FixtureType.DMX]),
    },
    outputs: {
        outputId: () => new NodeInterface<string | undefined>("OutputId", undefined).setHidden(true),
        data: () => new NodeInterface<number[]>("Data", []).setHidden(true),
    },
    onUpdate({ fixtureId }) {
        if (!fixtureId) {
            return {};
        }

        const stage = useStage();
        const fixture = stage.fixtures.get(fixtureId) as DmxFixture;
        if (!fixture) {
            return {};
        }

        const inputs: DynamicNodeDefinition = {};
        for (let i = 0; i < fixture.channelNames.length; i++) {
            inputs[`channel_${i}`] = () => new DmxChannelInterface(fixture.channelNames[i]);
        }

        return { inputs };
    },
    calculate({ output, fixture, ...channels }) {
        const data = [];
        for (const [channel, value] of Object.entries(channels)) {
            const channelOffset = parseInt(channel.replace("channel_", ""));
            data[channelOffset] = value;
        }

        return { outputId: output, data };
    },
});
