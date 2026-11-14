import { v4 as uuidv4 } from "uuid";
import { SequentialHook } from "@baklavajs/events";
import { isTarget, type Target } from "@/programming/types";

export interface ITrackState {
    id: string;
    name: string;
    height: number;
    removable: boolean;
    data?: Record<string, any>;
    /** feature 004: default target new items on this track inherit (default null) */
    defaultTarget?: Target | null;
}

export class Track {
    public static load(state: ITrackState): Track {
        const t = new Track(state.name, state.data);
        t.id = state.id;
        t.height = state.height;
        t.removable = state.removable;
        t.defaultTarget = isTarget(state.defaultTarget) ? { kind: state.defaultTarget.kind, id: state.defaultTarget.id } : null;
        return t;
    }

    public id = uuidv4();
    public data?: Record<string, any>;

    public hooks = {
        save: new SequentialHook<ITrackState, this>(this),
    };

    public name: string;
    public height = 100;
    public removable = true;
    /** feature 004 (research R5): target new items on this track inherit. */
    public defaultTarget: Target | null = null;

    public constructor(name: string, data?: Record<string, any>) {
        this.name = name;
        this.data = data;
    }

    public save(): ITrackState {
        return {
            id: this.id,
            name: this.name,
            height: this.height,
            removable: this.removable,
            data: { ...this.data },
            defaultTarget: this.defaultTarget ? { ...this.defaultTarget } : null,
        };
    }
}
