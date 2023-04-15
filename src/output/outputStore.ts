import { defineStore } from "pinia";
import { WsMessage } from "lms_bridge/WsMessage";
import { LibraryItemType, useLibrary } from "@/library";
import { OutputLibraryItem } from "./output.libraryItem";
import { OutputType } from "./outputTypes";
import { DmxOutput } from "./dmx/dmx.output";
import { WledOutput } from "./wled/wled.output";

export const useOutputStore = defineStore("outputStore", () => {
    const bridge = new WebSocket("ws://localhost:1234");
    const library = useLibrary();

    function updateOutputs() {
        const outputs = library.items.filter((it) => it.type === LibraryItemType.OUTPUT) as OutputLibraryItem[];
        const relevantOutputs = outputs
            .filter((o) => [OutputType.DMX, OutputType.WLED].includes(o.outputInstance.type))
            .map((o) => o.outputInstance) as Array<DmxOutput | WledOutput>;
        const msg: WsMessage = {
            type: "ConfigureOutputs",
            outputs: relevantOutputs.map((o) => o.getBridgeConfiguration()),
        };
        sendMessage(msg);
    }

    function sendMessage(message: WsMessage) {
        if (bridge.readyState === WebSocket.OPEN) {
            bridge.send(JSON.stringify(message));
        }
    }

    return { updateOutputs, sendMessage };
});
