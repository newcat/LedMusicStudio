import { markRaw } from "vue";
import { BaseFixture, FixtureType } from "../base.fixture";
import { Fixture as OpenFixtureDefinition } from "./open-fixture";
import DmxFixtureSettings from "./DmxFixtureSettings.vue";

interface DmxFixtureConfiguration {
    definition: OpenFixtureDefinition | null;
    startChannel: number;
    mode: OpenFixtureDefinition["modes"][0] | null;
}

export class DmxFixture extends BaseFixture<number[], DmxFixtureConfiguration> {
    public override readonly type = FixtureType.DMX;
    public override readonly settingsComponent = markRaw(DmxFixtureSettings);

    public get validationErrors(): string[] {
        if (!this.config.definition) {
            return ["Please select a fixture"];
        } else if (!this.config.mode) {
            return ["Please select a mode"];
        }
        return [];
    }

    public get channelNames(): string[] {
        if (!this.config.definition || !this.config.mode) {
            return [];
        }

        const channelNames: string[] = [];
        for (const channel of this.config.mode.channels) {
            if (typeof channel === "string") {
                channelNames.push(channel);
            } else if (channel) {
                let repeats: string[] = [];
                if (channel.repeatFor === "eachPixelGroup") {
                    repeats = Object.keys(this.config.definition.matrix!.pixelGroups!);
                } else if (Array.isArray(channel.repeatFor)) {
                    repeats = channel.repeatFor;
                } else {
                    // multiply together all pixel counts (e.g. for [8,1,1] = 8*1*1 = 8)
                    const count = this.config.definition.matrix!.pixelCount!.reduce((p, c) => p * c, 1);
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
        return this.channelNames.map((c, i) => this.config.startChannel + i);
    }

    public constructor() {
        super([], {
            definition: null,
            startChannel: 1,
            mode: null,
        });
        this.name = "DMX Fixture";
    }
}
