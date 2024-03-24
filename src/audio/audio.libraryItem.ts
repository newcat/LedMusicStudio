import { BaklavaEvent } from "@baklavajs/events";
import { LibraryItem, LibraryItemType } from "@/library";
import WaveformWorker from "./workerInstance";
import { getNativeAdapter } from "@/native";

export interface IWaveformPart {
    start: number;
    end: number;
    canvas: HTMLCanvasElement;
}

export interface IWaveform {
    count: number;
    parts: IWaveformPart[];
}

export interface AudioLibraryItemState {
    path: string;
}

export class AudioLibraryItem extends LibraryItem<AudioLibraryItemState> {
    public static sampleRate = 48000;

    public type = LibraryItemType.AUDIO;
    public name = "";
    public path = "";
    public audioBuffer: AudioBuffer | null = null;
    public waveform: IWaveform | null = null;

    public events = {
        loaded: new BaklavaEvent<void, this>(this),
    };

    public override save() {
        return {
            path: this.path,
        };
    }

    public override async load(state: AudioLibraryItemState) {
        this.path = state.path;
        await this.loadAudio();
    }

    public async chooseAudioFile(): Promise<boolean> {
        const nativeAdapter = getNativeAdapter();
        if (nativeAdapter.isElectron()) {
            const dialogResult = await nativeAdapter.showOpenDialog({
                title: "Select Audio File",
                filters: [
                    { name: "Audio Files", extensions: ["mp3", "wav", "flac", "ogg"] },
                    { name: "All Files", extensions: ["*"] },
                ],
            });
            if (dialogResult.canceled) {
                return false;
            }
            if (!this.name) {
                this.name = dialogResult.filePaths![0].replace(/^.*[\\/]/, "");
            }
            this.path = dialogResult.filePaths![0];
            await this.loadAudio();
        } else {
            const result = await nativeAdapter.chooseAndReadFile({
                accept: [{ name: "Audio Files", extensions: ["audio/*"] }],
            });
            if (!result) {
                return false;
            }
            if (!this.name) {
                this.name = result.path!;
            }
            await this.loadAudio(result.data);
        }
        return true;
    }

    public async loadAudio(data?: Uint8Array) {
        this.loading = true;
        this.error = "";

        if (!data) {
            if (!this.path) {
                this.loading = false;
                this.error = "Cannot load audio without path or data";
                return;
            }

            const nativeAdapter = getNativeAdapter();
            if (!nativeAdapter.isElectron()) {
                this.loading = false;
                this.error = "Cannot load audio from path without Electron";
                return;
            }

            try {
                data = await nativeAdapter.readFile(this.path);
            } catch (err) {
                console.warn(err);
                this.loading = false;
                this.error = String(err);
                return;
            }
        }

        try {
            const offlineAudioContext = new OfflineAudioContext(1, 2, AudioLibraryItem.sampleRate);
            this.audioBuffer = await offlineAudioContext.decodeAudioData(data.buffer);
            this.waveform = await this.generateWaveform();
        } catch (err) {
            console.warn(err);
            this.error = String(err);
        }

        this.loading = false;
        this.events.loaded.emit();
    }

    private async generateWaveform(): Promise<IWaveform> {
        const samples = this.audioBuffer!.getChannelData(0);
        const rawWaveform = await WaveformWorker.generateWaveform(samples, AudioLibraryItem.sampleRate, 1024);

        const parts: IWaveformPart[] = [];
        for (const part of rawWaveform.parts) {
            const cv = document.createElement("canvas");
            cv.width = part.image.width;
            cv.height = part.image.height;
            const ctx = cv.getContext("2d")!;
            ctx.drawImage(part.image, 0, 0);
            parts.push({ start: part.start, end: part.end, canvas: cv });
        }

        return {
            count: rawWaveform.count,
            parts,
        };
    }
}
