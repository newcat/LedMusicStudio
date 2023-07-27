import { BaseOutput } from "../base.output";
import { OutputType } from "../outputTypes";
import { DmxFixture } from "./fixture";
import { useOutputStore } from "../outputStore";
import { BaseOutputConfiguration } from "lms_bridge/BaseOutputConfiguration";

export interface IDmxOutputState {
    port: string;
    fixtures: DmxFixture[];
}

export interface IDmxOutputData {
    channels: Map<number, number>;
}

export class DmxOutput extends BaseOutput<IDmxOutputState, IDmxOutputData> {
    public type = OutputType.DMX;

    public port = "";
    public fixtures: DmxFixture[] = [];

    private currentChannelValues: Map<number, number> = new Map();
    private outputStore = useOutputStore();

    public async update() {
        this.outputStore.updateOutputs();
    }

    public onData(data?: IDmxOutputData) {
        if (!data) {
            return;
        }

        data.channels.forEach((value, channel) => {
            if (channel > 0) {
                this.currentChannelValues.set(channel, value);
            }
        });
    }

    public async send() {
        const maxChannel = Math.max(0, ...Array.from(this.currentChannelValues.keys()));
        if (maxChannel <= 0) {
            return;
        }

        const buffer: number[] = new Array(maxChannel + 2);
        buffer[0] = Math.floor(maxChannel / 256);
        buffer[1] = maxChannel % 256;
        for (let i = 1; i <= maxChannel; i++) {
            buffer[i + 1] = this.currentChannelValues.get(i) ?? 0;
        }

        this.outputStore.sendMessage({
            type: "DmxData",
            id: this.id,
            data: buffer,
        });
    }

    public toObject(): IDmxOutputState {
        return {
            port: this.port,
            fixtures: this.fixtures,
        };
    }

    public async fromObject(state: IDmxOutputState): Promise<void> {
        this.port = state.port;
        this.fixtures = state.fixtures.map((f) => {
            const fixture = new DmxFixture(f.definition, f.startChannel);
            fixture.id = f.id;
            fixture.name = f.name;
            return fixture;
        });
        await this.update();
    }

    public getBridgeConfiguration(): BaseOutputConfiguration {
        return {
            id: this.id,
            output: {
                type: "Dmx",
                port: this.port,
            },
        };
    }
}
