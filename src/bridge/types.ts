import { ControllerType } from "lms_bridge/ControllerType";

/**
 * Needs to be implemented by all controllers using the bridge.
 */
 
export interface IBridgeController<ControllerToBridgeMessage, BridgeToControllerMessage> {
    id: string;
    type: ControllerType;
    onBridgeConnected(): any;
    getConfigurationMessage(): ControllerToBridgeMessage | null;
    getValueMessage(): ControllerToBridgeMessage | null;
    onBridgeMessage?: (msg: BridgeToControllerMessage) => any;
}

export type SendMessageFunction<ControllerToBridgeMessage> = (msg: ControllerToBridgeMessage) => void;
