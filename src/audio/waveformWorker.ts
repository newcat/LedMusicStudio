import * as Comlink from "comlink";

export interface IWaveformPart {
    start: number;
    end: number;
    image: ImageBitmap;
}

export interface IWaveform {
    count: number;
    parts: IWaveformPart[];
}

export class WaveformWorker {
    public generateWaveform(samples: Float32Array, sampleRate: number, resolution: number): IWaveform {
        const peaks = this.calculatePeaks(samples, sampleRate, resolution);
        const parts: IWaveformPart[] = [];
        for (let i = 0; i < peaks.length; i += 1024) {
            const end = Math.min(i + 1024, peaks.length);
            const image = this.createPartWaveformTexture(peaks, i, end);
            parts.push({ start: i, end, image });
        }
        const r = {
            count: peaks.length,
            parts,
        };
        Comlink.transfer(
            r,
            r.parts.map((p) => p.image)
        );
        return r;
    }

    private calculatePeaks(samples: Float32Array, sampleRate: number, resolution: number) {
        const peakSpan = Math.round(sampleRate / resolution);
        const peakCount = Math.ceil(samples.length / peakSpan);
        const peaks = new Uint8Array(peakCount);

        for (let i = 0; i < peakCount; i++) {
            let max = 0;
            for (let j = i * peakSpan; j < (i + 1) * peakSpan; j++) {
                if (Math.abs(samples[j]) > max) {
                    max = Math.abs(samples[j]);
                }
            }
            const peakValue = Math.round(255 * max);
            peaks[i] = peakValue;
        }

        return peaks;
    }

    private createPartWaveformTexture(peaks: Uint8Array, start: number, end: number) {
        const canvas = new OffscreenCanvas(end - start, 300);
        const cvCtx = canvas.getContext("2d")!;
        const center = 300 / 2;
        cvCtx.fillStyle = "#bbbbbb";
        cvCtx.beginPath();
        cvCtx.moveTo(0, center);
        for (let i = start; i < end; i++) {
            const pxOffCenter = (300 / 2) * (peaks[i] / 255);
            cvCtx.lineTo(i - start, center - pxOffCenter);
        }
        for (let i = end - 1; i >= start; i--) {
            const pxOffCenter = (300 / 2) * (peaks[i] / 255);
            cvCtx.lineTo(i - start, center + pxOffCenter);
        }
        cvCtx.closePath();
        cvCtx.fill();

        return canvas.transferToImageBitmap();
    }
}

const waveformWorker = new WaveformWorker();
Comlink.expose(waveformWorker);
