import { markRaw } from "vue";

import { IBridgeController, SendMessageFunction, useBridge } from "@/bridge";
import { LedStripFixture } from "../../fixtures/ledStrip/ledStrip.fixture";
import { BaseController, ControllerType } from "../base.controller";
import WledControllerSettings from "./WledControllerSettings.vue";
import { FixtureType } from "@/stage/fixtures";
import { WledControllerMessage } from "lms_bridge/WledControllerMessage";

interface WledControllerConfiguration {
    host: string;
    port: number;
    timeout: number;
}

export class WledController
    extends BaseController<WledControllerConfiguration, LedStripFixture>
    implements IBridgeController<WledControllerMessage, void>
{
    private readonly bridge = useBridge();
    private readonly sendMessage: SendMessageFunction<WledControllerMessage>;

    public override readonly type = ControllerType.WLED;
    public override readonly compatibleFixtures = [FixtureType.LED_STRIP];
    public override readonly settingsComponent = markRaw(WledControllerSettings);

    public override get validationErrors(): string[] {
        return [];
    }

    constructor() {
        super({
            host: "127.0.0.1",
            port: 21324,
            timeout: 255,
        });
        this.name = "WLED Controller";
        this.sendMessage = this.bridge.registerController(this);
        this.sendConfiguration();
    }

    public override addFixture(f: LedStripFixture): void {
        if (this.controlledFixtures.length > 0) {
            throw new Error("WLED controller can only control one fixture");
        }
        super.addFixture(f);
    }

    public override setConfig(c: WledControllerConfiguration): void {
        super.setConfig(c);
        this.sendConfiguration();
    }

    public send() {
        const msg = this.getValueMessage();
        if (msg) {
            this.sendMessage(msg);
        }
    }

    public onBridgeConnected() {
        this.sendConfiguration();
    }

    public override dispose(): void {
        this.bridge.unregisterController(this.id);
    }

    public getConfigurationMessage() {
        return {
            type: "UpdateConfiguration",
            host: this.config.host,
            port: this.config.port,
        } satisfies WledControllerMessage;
    }

    public getValueMessage() {
        if (this.controlledFixtures.length === 0) {
            return null;
        }

        const fixture = this.controlledFixtures[0];
        const colors = fixture.value;
        if (!colors || colors.length !== fixture.config.numLeds) {
            return null;
        }

        const buff = new Array(3 * fixture.config.numLeds + 2);

        buff[0] = 2; // Use DRGB protocol
        buff[1] = this.config.timeout;

        for (let i = 0; i < fixture.config.numLeds; i++) {
            buff[i * 3 + 2] = Math.floor(colors[i][0]);
            buff[i * 3 + 3] = Math.floor(colors[i][1]);
            buff[i * 3 + 4] = Math.floor(colors[i][2]);
        }

        return {
            type: "Data",
            data: buff,
        } satisfies WledControllerMessage;
    }

    private sendConfiguration() {
        this.sendMessage(this.getConfigurationMessage());
    }
}
