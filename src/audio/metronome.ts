import { useGlobalState } from "@/globalState";
import { AudioProcessor } from "./audio.processor";
import tickSound from "./tick.mp3?url";

export class Metronome {
    private metronomeTickBuffer?: AudioBuffer;
    private lastTick = 0;
    private globalState = useGlobalState();

    public constructor(private readonly audioProcessor: AudioProcessor) {
        void this.initializeMetronomeTick();
    }

    public tick(unit: number) {
        if (!this.globalState.metronome) {
            this.lastTick = 0;
            return;
        }

        if (this.lastTick === 0) {
            this.lastTick = unit;
        }

        const lastWholeUnit = unit - (unit % 24);
        if (this.lastTick < lastWholeUnit) {
            if (lastWholeUnit % 96 === 0) {
                this.playFullBarMetronomeTick();
            } else {
                this.playMetronomeTick();
            }
        }
        this.lastTick = unit;
    }

    private playMetronomeTick() {
        if (!this.metronomeTickBuffer) {
            return;
        }
        this.audioProcessor.playRaw(this.metronomeTickBuffer);
    }

    private playFullBarMetronomeTick() {
        if (!this.metronomeTickBuffer) {
            return;
        }
        const source = this.audioProcessor.playRaw(this.metronomeTickBuffer);
        source.detune.value = 400;
    }

    private async initializeMetronomeTick() {
        const res = await fetch(tickSound);
        const arrayBuffer = await res.arrayBuffer();
        this.metronomeTickBuffer = await this.audioProcessor.audioContext.decodeAudioData(arrayBuffer);
    }
}
