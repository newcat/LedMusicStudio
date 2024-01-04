import { markRaw } from "vue";

import { BaseOutputConfiguration } from "lms_bridge/BaseOutputConfiguration";
import { useBridge } from "@/bridge";
import { BaseController, ControllerType } from "../base.controller";
import { DmxFixture } from "../../fixtures";
import DmxControllerSettings from "./DmxControllerSettings.vue";

interface DmxControllerConfiguration {
    port: string;
}

export class DmxController extends BaseController<DmxControllerConfiguration, DmxFixture> {
    private readonly bridge = useBridge();
    public override readonly type = ControllerType.DMX;
    public override readonly settingsComponent = markRaw(DmxControllerSettings);

    public constructor() {
        super({ port: "" });
        this.name = "DMX Controller";
    }

    public async send() {
        // TODO
        /*const maxChannel = Math.max(0, ...Array.from(this.currentChannelValues.keys()));
        if (maxChannel <= 0) {
            return;
        }

        const buffer: number[] = new Array(maxChannel + 2);
        buffer[0] = Math.floor(maxChannel / 256);
        buffer[1] = maxChannel % 256;
        for (let i = 1; i <= maxChannel; i++) {
            buffer[i + 1] = this.currentChannelValues.get(i) ?? 0;
        }

        this.bridge.sendMessage({
            type: "DmxData",
            id: this.id,
            data: buffer,
        });*/
    }

    public getBridgeConfiguration(): BaseOutputConfiguration {
        return {
            id: this.id,
            output: {
                type: "Dmx",
                port: this.config.port,
            },
        };
    }
}
