import { markRaw } from "vue";

import { BaseOutputConfiguration } from "lms_bridge/BaseOutputConfiguration";
import { useBridge } from "@/bridge";
import { LedStripFixture } from "../../fixtures/ledStrip/ledStrip.fixture";
import { BaseController, ControllerType } from "../base.controller";
import WledControllerSettings from "./WledControllerSettings.vue";

interface WledControllerConfiguration {
    host: string;
    port: number;
    timeout: number;
}

export class WledController extends BaseController<WledControllerConfiguration, LedStripFixture> {
    private readonly bridge = useBridge();
    public override readonly type = ControllerType.WLED;
    public override readonly settingsComponent = markRaw(WledControllerSettings);

    constructor() {
        super({
            host: "127.0.0.1",
            port: 21324,
            timeout: 255,
        });
        this.name = "WLED Controller";
    }

    public override addFixture(f: LedStripFixture): void {
        if (this.controlledFixtures.length > 0) {
            throw new Error("WLED controller can only control one fixture");
        }
        super.addFixture(f);
    }

    public async send(): Promise<void> {
        if (this.controlledFixtures.length === 0) {
            return;
        }

        const fixture = this.controlledFixtures[0];
        const colors = fixture.value;
        const buff = new Array(3 * fixture.config.numLeds + 2);

        buff[0] = 2; // Use DRGB protocol
        buff[1] = this.config.timeout;

        for (let i = 0; i < fixture.config.numLeds; i++) {
            buff[i * 3 + 2] = colors[i][0];
            buff[i * 3 + 3] = colors[i][1];
            buff[i * 3 + 4] = colors[i][2];
        }

        this.bridge.sendMessage({
            type: "WledData",
            id: this.id,
            data: buff,
        });
    }

    public getBridgeConfiguration(): BaseOutputConfiguration {
        return {
            id: this.id,
            output: {
                type: "Wled",
                host: this.config.host,
                port: this.config.port,
            },
        };
    }
}
