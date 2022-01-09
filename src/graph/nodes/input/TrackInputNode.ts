import { Node } from "@baklavajs/core";
import { globalState } from "@/globalState";
import { ICalculationData } from "../../types";
import Vue from "vue";

export abstract class TrackInputNode extends Node {
    private vueInstance: Vue;

    public constructor() {
        super();
        this.addOption("Track", "SelectOption", "", undefined, { items: [] });

        // Hacky workaround because the nx-js observer doesnt pick the change up
        // for whatever reason
        this.vueInstance = new Vue();
        this.vueInstance.$watch(
            () => globalState.timeline.tracks.map((t) => t.name),
            () => {
                this.updateAvailableTracks();
            },
            { immediate: true }
        );
    }

    protected getTrackValue(data: ICalculationData): unknown {
        const { trackValues } = data;
        const selectedTrack = this.getOptionValue("Track");
        if (selectedTrack) {
            return trackValues.get(selectedTrack);
        }
    }

    public destroy() {
        this.vueInstance.$destroy();
    }

    private updateAvailableTracks() {
        const optionItems: Array<{ text: string; value: string }> = [];
        for (const track of globalState.timeline.tracks) {
            optionItems.push({ text: track.name, value: track.id });
        }
        const trackOption = this.options.get("Track")!;
        trackOption.items = optionItems;
        trackOption.events.updated.emit();
    }
}
