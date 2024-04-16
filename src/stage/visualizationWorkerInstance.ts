/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { markRaw } from "vue";
import * as Comlink from "comlink";
import { RemoteStageRenderer } from "@/visualization/stageRenderer";

export function createVisualizationWorkerInstance() {
    const bc = new BroadcastChannel("visualization");
    const renderer = Comlink.wrap<RemoteStageRenderer>(bc);
    const rendererProxy = new Proxy<typeof renderer>({} as any, {
        get(target: any, prop) {
            if (typeof prop === "string" && prop.startsWith("__v_")) {
                return target[prop];
            }
            return (renderer as any)[prop];
        },
        set(target: any, prop, value) {
            if (typeof prop === "string" && prop.startsWith("__v_")) {
                target[prop] = value;
                return true;
            }
            (renderer as any)[prop] = value;
            return true;
        },
    });
    return markRaw(rendererProxy) as RemoteStageRenderer;
}
