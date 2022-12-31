import type { Socket } from "dgram";
import { Buffer } from "buffer";
import { Color } from "@/graph/colors";
import { scaleColorArray } from "@/utils";
import { dgramCreateSocket } from "@/native";
import { BaseOutput } from "../base.output";
import { OutputType } from "../outputTypes";

export interface IWledOutputState {
    host: string;
    port: number;
    timeout: number;
    numLeds: number;
}

export interface IWledOutputData {
    colors: Color[];
}

export class WledOutput extends BaseOutput<IWledOutputState, IWledOutputData> {
    public type = OutputType.WLED;

    public host = "127.0.0.1";
    public port = 21324;
    public timeout = 255;
    public numLeds = 60;

    private socket?: Socket;
    private buff?: Buffer;

    public update() {
        this.error = "";
        this.socket?.close();
        this.socket = dgramCreateSocket("udp4");
    }

    public onData(data?: IWledOutputData): void {
        let colors: Color[] = [[0, 0, 0]];
        if (data && data.colors) {
            colors = data.colors;
        }

        this.buff = Buffer.allocUnsafe(3 * this.numLeds + 2);
        colors = scaleColorArray(colors, this.numLeds);

        this.buff[0] = 2; // Use DRGB protocol
        this.buff[1] = this.timeout;

        for (let i = 0; i < this.numLeds; i++) {
            this.buff[i * 3 + 2] = colors[i][0];
            this.buff[i * 3 + 3] = colors[i][1];
            this.buff[i * 3 + 4] = colors[i][2];
        }
    }

    public send(): void {
        if (!this.socket || !this.buff) {
            return;
        }
        this.socket.send(this.buff, this.port, this.host, (err) => {
            if (err) {
                this.error = "Failed to send WLED data";
                console.warn(`Failed to send WLED data to ${this.host}:${this.port}`, err);
            }
        });
    }

    public toObject(): IWledOutputState {
        return {
            host: this.host,
            port: this.port,
            timeout: this.timeout,
            numLeds: this.numLeds,
        };
    }

    public async fromObject(state: IWledOutputState): Promise<void> {
        this.host = state.host;
        this.port = state.port;
        this.timeout = state.timeout;
        this.numLeds = state.numLeds;
        this.update();
        return Promise.resolve();
    }

    public destroy(): Promise<void> {
        this.socket?.close();
        return Promise.resolve();
    }
}
