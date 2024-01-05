import { BaseController, ControllerType } from "./base.controller";
import { DmxController } from "./dmx/dmx.controller";
import { RazerChromaController } from "./razerchroma/chroma.controller";
import { WledController } from "./wled/wled.controller";

export function createController(type: ControllerType): BaseController {
    switch (type) {
        case ControllerType.WLED:
            return new WledController();
        case ControllerType.DMX:
            return new DmxController();
        case ControllerType.RAZER_CHROMA:
            return new RazerChromaController();
        default:
            throw new Error(`Unknown controller type ${type}`);
    }
}
