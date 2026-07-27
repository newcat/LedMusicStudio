import { markRaw } from "vue";
import { BaseFixture, FixtureType } from "../base.fixture";
import { Channel as OpenFixtureChannel, Fixture as OpenFixtureDefinition } from "./open-fixture";
import DmxFixtureSettings from "./DmxFixtureSettings.vue";

interface DmxFixtureConfiguration {
    definition: OpenFixtureDefinition | null;
    startChannel: number;
    mode: OpenFixtureDefinition["modes"][0] | null;
}

/** One DMX channel slot of the selected mode, with the definition it resolves to (if the fixture library provides one). */
export interface ResolvedDmxChannel {
    name: string;
    definition: OpenFixtureChannel | null;
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

    public get resolvedChannels(): ResolvedDmxChannel[] {
        const { definition, mode } = this.config;
        if (!definition || !mode) {
            return [];
        }

        const channels: ResolvedDmxChannel[] = [];
        for (const channel of mode.channels) {
            if (typeof channel === "string") {
                channels.push({ name: channel, definition: definition.availableChannels?.[channel] ?? null });
            } else if (channel) {
                let repeats: string[] = [];
                if (channel.repeatFor === "eachPixelGroup") {
                    repeats = Object.keys(definition.matrix!.pixelGroups!);
                } else if (Array.isArray(channel.repeatFor)) {
                    repeats = channel.repeatFor;
                } else {
                    // multiply together all pixel counts (e.g. for [8,1,1] = 8*1*1 = 8)
                    const count = definition.matrix!.pixelCount!.reduce((p, c) => p * c, 1);
                    for (let i = 1; i <= count; i++) {
                        repeats.push(i.toString());
                    }
                }

                for (const repeat of repeats) {
                    for (const templateKey of channel.templateChannels) {
                        channels.push({
                            name: templateKey!.replaceAll("$pixelKey", repeat),
                            definition: definition.templateChannels?.[templateKey!] ?? null,
                        });
                    }
                }
            }
        }
        return channels;
    }

    public get channelNames(): string[] {
        return this.resolvedChannels.map((c) => c.name);
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

    public override setValue(v: number[]): void {
        const normalizedValues = v.map((val) => (isNaN(val) ? 0 : Math.max(0, Math.min(255, Math.floor(val)))));
        super.setValue(normalizedValues);
    }
}
