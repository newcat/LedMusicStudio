import { defineStore } from "pinia";
import { WsMessage } from "lms_bridge/WsMessage";

export const useOutputStore = defineStore("outputStore", () => {
    const bridge = new WebSocket("ws://localhost:1234");

    function sendMessage(message: WsMessage) {
        if (bridge.readyState === WebSocket.OPEN) {
            bridge.send(JSON.stringify(message));
        }
    }

    return { sendMessage };
});
