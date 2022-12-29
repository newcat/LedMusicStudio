import { Fixture as OpenFixtureDefinition } from "./open-fixture";

export class DmxFixture {
    public mode: OpenFixtureDefinition["modes"][0];
    public name: string;

    public constructor(public readonly definition: OpenFixtureDefinition, public readonly startChannel: number) {
        this.mode = definition.modes[0];
        this.name = definition.name;
    }

    public get usedChannels(): number[] {
        const channels: number[] = [];
        for (let i = 0; i < this.mode.channels.length; i++) {
            channels.push(this.startChannel + i);
        }
        return channels;
    }
}
