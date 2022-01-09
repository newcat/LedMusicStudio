import { serialize, deserialize } from "bson";
import { LibraryItem, LibraryItemType } from "@/library";
import WaveformWorker from "./workerInstance";
import { BaklavaEvent } from "@baklavajs/events";
import { readFile } from "fs";
import { promisify } from "util";

export interface IWaveformPart {
    start: number;
    end: number;
    url: string;
}

export interface IWaveform {
    count: number;
    parts: IWaveformPart[];
}

export class AudioLibraryItem extends LibraryItem {
    public static sampleRate = 192000;

    public type = LibraryItemType.AUDIO;
    public name = "Empty";
    public path = "";
    public audioBuffer: AudioBuffer | null = null;
    public waveform: IWaveform | null = null;

    public events = {
        loaded: new BaklavaEvent<void>(),
    };

    public async load() {
        this.loading = true;
        this.error = false;

        if (!this.path) {
            this.loading = false;
            this.error = true;
            return;
        }

        try {
            console.log("Reading Data");
            const timeoutSymbol = Symbol("timeout");
            const rawData = await Promise.race([
                promisify(readFile)(this.path),
                new Promise<symbol>((res) => setTimeout(res, 5000, timeoutSymbol)),
            ]);
            if (rawData === timeoutSymbol) {
                throw new Error("Timeout while reading data");
            }

            console.log("Creating Offline Context with sample rate", AudioLibraryItem.sampleRate);
            const offlineAudioContext = new OfflineAudioContext(1, 2, AudioLibraryItem.sampleRate);
            console.log("Decoding...");
            this.audioBuffer = await offlineAudioContext.decodeAudioData((rawData as Buffer).buffer);

            console.log("Creating waveform");
            this.waveform = await this.generateWaveform();
        } catch (err) {
            console.warn(err);
            this.error = true;
        }

        this.loading = false;
        this.events.loaded.emit();
    }

    public serialize() {
        return serialize({
            id: this.id,
            name: this.name,
            path: this.path,
        });
    }

    public deserialize(buffer: Buffer): void {
        const { id, name, path } = deserialize(buffer);
        this.id = id;
        this.name = name;
        this.path = path;
    }

    private async generateWaveform(): Promise<IWaveform> {
        const samples = this.audioBuffer!.getChannelData(0);
        // Important! Using transferable for the samples crashes Electron 8.4+
        const rawWaveform = await WaveformWorker.generateWaveform(samples, AudioLibraryItem.sampleRate, 1024);

        const parts: IWaveformPart[] = [];
        for (const part of rawWaveform.parts) {
            const cv = document.createElement("canvas");
            cv.width = part.image.width;
            cv.height = part.image.height;
            const ctx = cv.getContext("2d")!;
            ctx.drawImage(part.image, 0, 0);
            const url = cv.toDataURL();
            parts.push({ start: part.start, end: part.end, url });
        }

        return {
            count: rawWaveform.count,
            parts,
        };
    }
}
