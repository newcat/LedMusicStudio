import { watch } from "vue";
import { Node } from "@baklavajs/core";
import { useGlobalState } from "@/globalState";
import { ICalculationData } from "../../types";
import { INote } from "@/pattern";
import { SelectInterface } from "@baklavajs/renderer-vue";

export interface TrackInputNodeInputs {
    track: string;
}

export abstract class TrackInputNode<I extends TrackInputNodeInputs, O> extends Node<I, O> {
    private readonly globalState = useGlobalState();
    private unwatch?: () => void;

    public constructor() {
        super();
    }

    protected override initializeIo() {
        super.initializeIo();

        this.unwatch = watch(
            () => this.globalState.timeline.tracks.map((t) => t.name),
            () => {
                this.updateAvailableTracks();
            },
            { immediate: true }
        );
    }

    protected getTrackValue<T extends number | INote[]>(inputs: TrackInputNodeInputs, data: ICalculationData): T | undefined {
        const { trackValues } = data;
        const { track } = inputs;
        if (track) {
            return trackValues.get(track) as T;
        }
    }

    public destroy() {
        this.unwatch?.();
    }

    private updateAvailableTracks() {
        const optionItems: Array<{ text: string; value: string }> = [];
        for (const track of this.globalState.timeline.tracks) {
            optionItems.push({ text: track.name, value: track.id });
        }
        const trackIntf = this.inputs.track as SelectInterface;
        trackIntf.items = optionItems;
        trackIntf.events.updated.emit();
    }
}
