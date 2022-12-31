import { Buffer } from "buffer";
import { v4 as uuidv4 } from "uuid";
import { ipcRenderer } from "@/native";
import { BaseOutput } from "../base.output";
import { OutputType } from "../outputTypes";
import { DmxFixture } from "./fixture";

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

    private id = uuidv4();
    private currentChannelValues: Map<number, number> = new Map();

    public async update() {
        await this.open();
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

        const buffer = Buffer.alloc(maxChannel + 2);
        buffer[0] = Math.floor(maxChannel / 256);
        buffer[1] = maxChannel % 256;
        for (let i = 1; i <= maxChannel; i++) {
            buffer[i + 1] = this.currentChannelValues.get(i) ?? 0;
        }

        const result = await ipcRenderer.invoke("SERIALPORT_SEND", this.id, buffer);
        if (!result || !result.success) {
            this.error = "Failed to send data";
            console.warn(result);
        } else {
            this.error = "";
        }
    }

    public toObject(): IDmxOutputState {
        return {
            port: this.port,
            fixtures: this.fixtures,
        };
    }

    public async fromObject(state: IDmxOutputState): Promise<void> {
        this.port = state.port;
        this.fixtures = state.fixtures;
        await this.update();
    }

    public async destroy(): Promise<void> {
        const result = await ipcRenderer.invoke("SERIALPORT_CLOSE", this.id);
        if (!result || !result.success) {
            console.warn("Failed to close port", result);
        }
    }

    private async open() {
        if (!this.port) {
            return;
        }
        const result = await ipcRenderer.invoke("SERIALPORT_OPEN", this.id, this.port);
        if (!result || !result.success) {
            this.error = "Failed to open port";
            console.warn(result);
        }
    }
}
