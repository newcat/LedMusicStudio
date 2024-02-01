import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { useToast } from "primevue/usetoast";
import { WsMessage } from "lms_bridge/WsMessage";
import { useGlobalState } from "@/globalState";
import { IBridgeController, SendMessageFunction } from "./types";

export * from "./types";

export const useBridge = defineStore("bridge", () => {
    const globalState = useGlobalState();
    const toast = useToast();

    let bridge: WebSocket | undefined = undefined;
    const connectionStatus = ref<"DISCONNECTED" | "CONNECTING" | "CONNECTED">("DISCONNECTED");

    const controllers = ref<Map<string, IBridgeController<unknown>>>(new Map());

    function sendMessage(message: WsMessage) {
        if (bridge && bridge.readyState === WebSocket.OPEN) {
            bridge.send(JSON.stringify(message));
        }
    }

    function updateControllers() {
        for (const controller of controllers.value.values()) {
            sendMessage({
                type: "AddController",
                controller_type: controller.type,
                id: controller.id,
            });
            controller.onBridgeConnected();
        }
    }

    function connect() {
        const url = globalState.bridgeUrl;
        if (!url) {
            return;
        }

        if (bridge) {
            bridge.onclose = null;
            bridge.onopen = null;
            bridge.onerror = null;
            bridge.close();
        }

        console.log("Connecting to bridge using URL", url);
        connectionStatus.value = "CONNECTING";
        bridge = new WebSocket(`ws://${url}`);
        bridge.onopen = () => {
            connectionStatus.value = "CONNECTED";
            updateControllers();
        };
        bridge.onclose = () => {
            connectionStatus.value = "DISCONNECTED";
        };
        bridge.onerror = () => {
            toast.add({
                severity: "error",
                life: 2000,
                summary: "Error while connecting to the bridge",
            });
        };
    }

    function registerController<C2BM, C extends IBridgeController<unknown>>(controller: C): SendMessageFunction<C2BM> {
        controllers.value.set(controller.id, controller);

        sendMessage({
            type: "AddController",
            controller_type: controller.type,
            id: controller.id,
        });

        return (msg: C2BM) => {
            const bridgeMsg: WsMessage = {
                type: "CallController",
                id: controller.id,
                message: JSON.stringify(msg),
            };
            sendMessage(bridgeMsg);
        };
    }

    function unregisterController(id: string) {
        sendMessage({
            type: "RemoveController",
            id,
        });
        controllers.value.delete(id);
    }

    watch(() => globalState.bridgeUrl, connect, { immediate: true });

    return { connectionStatus, sendMessage, connect, registerController, unregisterController };
});
