import { watch } from "vue";
import { useGlobalState } from "@/globalState";
import { secondsToUnits, unitToSeconds } from "@/utils";

// inspired by: https://github.com/katspaugh/wavesurfer.js/blob/master/src/webaudio.js

interface IAudioTrack {
    buffer: AudioBuffer;
    startUnit: number;
    source: AudioBufferSourceNode | null;
}

export interface IAudioData {
    sampleRate: number;
    timeDomainData: Float32Array;
    frequencyData: Float32Array;
}

export class AudioProcessor {
    public static sampleRate = 44100;

    // WebAudio stuff
    public audioContext = new AudioContext();
    public analyserNode = this.audioContext.createAnalyser();
    private gainNode = this.audioContext.createGain();

    // State
    private state = useGlobalState();
    private tracks: IAudioTrack[] = [];
    private startTime = 0;
    private startPosition = 0;

    private unwatch: () => void;

    public constructor() {
        this.gainNode.connect(this.audioContext.destination);
        this.analyserNode.connect(this.gainNode);
        this.analyserNode.fftSize = 8192;
        AudioProcessor.sampleRate = this.audioContext.sampleRate;

        this.unwatch = watch(
            () => this.state.volume,
            () => this.gainNode.gain.setValueAtTime(this.state.volume, this.audioContext.currentTime),
            { immediate: true }
        );
        this.state.events.positionSetByUser.subscribe(this, async () => {
            if (this.state.isPlaying) {
                this.pause(false);
                await this.play();
            }
        });
    }

    public async play() {
        // need to re-create sources on each playback
        for (const t of this.tracks) {
            this.destroySource(t.source);
            t.source = this.createSource(t.buffer, t.startUnit);
        }
        this.startTime = this.audioContext.currentTime;
        this.startPosition = this.state.position;

        if (this.audioContext.state === "suspended" && this.audioContext.resume) {
            await this.audioContext.resume();
        }
    }

    public pause(updatePosition = true) {
        for (const t of this.tracks) {
            this.destroySource(t.source);
            t.source = null;
        }
        if (updatePosition) {
            this.updatePosition();
        }
    }

    public async destroy() {
        if (!this.state.isPlaying) {
            this.pause();
        }
        this.tracks = [];
        this.unwatch();
        this.gainNode.disconnect();
        this.analyserNode.disconnect();
        await this.audioContext.close();
    }

    public updatePosition(): number {
        if (!this.state.isPlaying) {
            return -1;
        }
        return this.startPosition + secondsToUnits(this.audioContext.currentTime - this.startTime, this.state.bpm);
    }

    public getAudioData(): IAudioData {
        const fftSize = this.analyserNode.fftSize;
        const timeDomainData = new Float32Array(fftSize);
        this.analyserNode.getFloatTimeDomainData(timeDomainData);
        const frequencyData = new Float32Array(fftSize);
        this.analyserNode.getFloatFrequencyData(frequencyData);
        return {
            sampleRate: AudioProcessor.sampleRate,
            timeDomainData,
            frequencyData,
        };
    }

    public registerBuffer(buffer: AudioBuffer, startUnit: number) {
        const source = this.state.isPlaying ? this.createSource(buffer, startUnit) : null;
        this.tracks.push({ buffer, startUnit, source });
    }

    public unregisterBuffer(buffer: AudioBuffer) {
        const i = this.tracks.findIndex((t) => t.buffer === buffer);
        if (i >= 0) {
            this.destroySource(this.tracks[i].source);
            this.tracks.splice(i, 1);
        } else {
            console.warn("Buffer not found");
        }
    }

    public playRaw(buffer: AudioBuffer): AudioBufferSourceNode {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.gainNode);
        source.addEventListener("ended", () => {
            source.disconnect();
        });
        source.start(this.audioContext.currentTime);
        return source;
    }

    private createSource(buffer: AudioBuffer, startUnit: number) {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.analyserNode);
        const offset = unitToSeconds(this.state.position - startUnit, this.state.bpm);
        if (offset < 0) {
            console.warn("Source offset < 0");
        }
        source.start(0, Math.max(offset, 0));
        return source;
    }

    private destroySource(source: AudioBufferSourceNode | null) {
        if (source) {
            source.stop(0);
            source.disconnect();
        }
    }
}
