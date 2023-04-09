import { v4 as uuidv4 } from "uuid";
import { Fixture as OpenFixtureDefinition } from "./open-fixture";

export class DmxFixture {
    public readonly id = uuidv4();
    public mode: OpenFixtureDefinition["modes"][0];
    public name: string;

    public constructor(public readonly definition: OpenFixtureDefinition, public readonly startChannel: number) {
        this.mode = definition.modes[0];
        this.name = definition.name;
    }

    public get channelNames(): string[] {
        const channelNames: string[] = [];
        for (const channel of this.mode.channels) {
            if (typeof channel === "string") {
                channelNames.push(channel);
            } else if (channel) {
                let repeats: string[] = [];
                if (channel.repeatFor === "eachPixelGroup") {
                    repeats = Object.keys(this.definition.matrix!.pixelGroups!);
                } else if (Array.isArray(channel.repeatFor)) {
                    repeats = channel.repeatFor;
                } else {
                    // multiply together all pixel counts (e.g. for [8,1,1] = 8*1*1 = 8)
                    const count = this.definition.matrix!.pixelCount!.reduce((p, c) => p * c, 1);
                    for (let i = 1; i <= count; i++) {
                        repeats.push(i.toString());
                    }
                }

                for (const repeat of repeats) {
                    channelNames.push(...channel.templateChannels.map((c) => c!.replaceAll("$pixelKey", repeat)));
                }
            }
        }
        return channelNames;
    }

    public get usedChannels(): number[] {
        return this.channelNames.map((c, i) => this.startChannel + i);
    }
}
