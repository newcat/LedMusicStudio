import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { useToast } from "primevue/usetoast";
import { WsMessage } from "lms_bridge/WsMessage";
import { useGlobalState } from "@/globalState";

export const useBridge = defineStore("bridge", () => {
    const globalState = useGlobalState();
    const toast = useToast();

    let bridge: WebSocket | undefined = undefined;
    const connectionStatus = ref<"DISCONNECTED" | "CONNECTING" | "CONNECTED">("DISCONNECTED");

    function updateControllers() {
        // TODO
        /*const outputs = library.items.filter((it) => it.type === LibraryItemType.OUTPUT) as OutputLibraryItem[];
        const relevantOutputs = outputs
            .filter((o) => [OutputType.DMX, OutputType.WLED].includes(o.outputInstance.type))
            .map((o) => o.outputInstance) as Array<DmxOutput | WledOutput>;
        const msg: WsMessage = {
            type: "ConfigureOutputs",
            outputs: relevantOutputs.map((o) => o.getBridgeConfiguration()),
        };
        sendMessage(msg);*/
    }

    function sendMessage(message: WsMessage) {
        if (bridge && bridge.readyState === WebSocket.OPEN) {
            bridge.send(JSON.stringify(message));
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

    watch(() => globalState.bridgeUrl, connect, { immediate: true });

    return { connectionStatus, updateControllers, sendMessage, connect };
});
