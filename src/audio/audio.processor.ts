import type { State } from "@/globalState";
import { watch } from "vue";

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
    private state: State;
    private tracks: IAudioTrack[] = [];
    private startTime = 0;
    private startPosition = 0;

    private unwatch: () => void;

    public constructor(state: State) {
        this.state = state;
        this.gainNode.connect(this.audioContext.destination);
        this.analyserNode.connect(this.gainNode);
        this.analyserNode.fftSize = 8192;
        AudioProcessor.sampleRate = this.audioContext.sampleRate;

        this.unwatch = watch(
            () => this.state.volume,
            () => this.gainNode.gain.setValueAtTime(this.state.volume, this.audioContext.currentTime)
        );
        this.state.events.positionSetByUser.subscribe(this, () => {
            if (this.state.isPlaying) {
                this.pause(false);
                this.play();
            }
        });
    }

    public supportsWebAudio() {
        return !!(window.AudioContext || (window as any).webkitAudioContext);
    }

    public play() {
        // need to re-create sources on each playback
        for (const t of this.tracks) {
            this.destroySource(t.source);
            t.source = this.createSource(t.buffer, t.startUnit);
        }
        this.startTime = this.audioContext.currentTime;
        this.startPosition = this.state.position;

        if (this.audioContext.state === "suspended" && this.audioContext.resume) {
            this.audioContext.resume();
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

    public destroy() {
        if (!this.state.isPlaying) {
            this.pause();
        }
        this.tracks = [];
        this.unwatch();
        this.gainNode.disconnect();
        this.analyserNode.disconnect();
        this.audioContext.close();
    }

    public updatePosition(): number {
        if (!this.state.isPlaying) {
            return -1;
        }
        return this.startPosition + this.secondsToUnits(this.audioContext.currentTime - this.startTime);
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

    public unitToSeconds(units: number) {
        return (units / 24) * (60 / this.state.bpm);
    }

    public secondsToUnits(seconds: number) {
        return (seconds / 60) * this.state.bpm * 24;
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

    private createSource(buffer: AudioBuffer, startUnit: number) {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.analyserNode);
        const offset = this.unitToSeconds(this.state.position - startUnit);
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
