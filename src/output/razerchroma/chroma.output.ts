import { Color } from "@/graph/colors";
import { scaleColorArray } from "@/utils";
import { BaseOutput } from "../base.output";
import { OutputType } from "../outputTypes";
import { ChromaApi } from "./chromaApi";

export interface IChromaOutputData {
    colors: Color[];
}

export class ChromaOutput extends BaseOutput<{}, IChromaOutputData> {
    public type = OutputType.RAZER_CHROMA;

    private api = new ChromaApi();
    private data: number[][] = [];
    private isSending = false;

    public constructor(id: string) {
        super(id);
        this.api.initialize();
    }

    public onData(data?: IChromaOutputData): void {
        let colors: Color[] = [[0, 0, 0]];
        if (data && data.colors) {
            colors = data.colors;
        }

        colors = scaleColorArray(colors, 22);
        const row: number[] = [];
        for (let i = 0; i < colors.length; i++) {
            row.push(256 * 256 * colors[i][2] + 256 * colors[i][1] + colors[i][0]);
        }

        this.data = [row, row, row, row, row, row];
    }

    public async send(): Promise<void> {
        if (this.isSending) {
            // skip this frame
            return;
        }
        this.isSending = true;
        await this.api.send(this.data);
        this.isSending = false;
    }

    public toObject(): {} {
        return {};
    }

    public fromObject(state: {}): Promise<void> {
        return Promise.resolve();
    }

    public async destroy(): Promise<void> {
        await this.api.destroy();
    }
}
