import { markRaw } from "vue";

import { DmxControllerMessage } from "lms_bridge/DmxControllerMessage";
import { IBridgeController, SendMessageFunction, useBridge } from "@/bridge";
import { BaseController, ControllerType } from "../base.controller";
import { DmxFixture, FixtureType } from "../../fixtures";
import DmxControllerSettings from "./DmxControllerSettings.vue";

interface DmxControllerConfiguration {
    port: string;
}

export class DmxController extends BaseController<DmxControllerConfiguration, DmxFixture> implements IBridgeController<void> {
    private readonly bridge = useBridge();
    private readonly sendMessage: SendMessageFunction<DmxControllerMessage>;

    public override readonly type = ControllerType.DMX;
    public override readonly compatibleFixtures = [FixtureType.DMX];
    public override readonly settingsComponent = markRaw(DmxControllerSettings);

    public override get validationErrors(): string[] {
        // check if the channels of any two fixtures overlap
        const channels = new Map<number, string[]>();
        for (const fixture of this.controlledFixtures) {
            for (const channel of fixture.usedChannels) {
                const arr = channels.get(channel) ?? [];
                arr.push(fixture.name);
                channels.set(channel, arr);
            }
        }
        const errors: string[] = [];
        for (const [channel, fixtures] of channels.entries()) {
            if (fixtures.length > 1) {
                errors.push(`Channel ${channel} is used by ${fixtures.join(", ")}`);
            }
        }

        if (this.config.port === "") {
            errors.push("No port selected");
        }
        return errors;
    }

    public constructor() {
        super({ port: "" });
        this.name = "DMX Controller";
        this.sendMessage = this.bridge.registerController(this);
        this.sendConfiguration();
    }

    public onBridgeConnected() {
        this.sendConfiguration();
    }

    public async send() {
        if (this.controlledFixtures.length === 0) {
            return;
        }

        const channelValues = new Map<number, number>();
        for (const fixture of this.controlledFixtures) {
            const fixtureChannelValues = fixture.value;
            for (const [channel, value] of fixtureChannelValues.entries()) {
                channelValues.set(fixture.config.startChannel + channel, value);
            }
        }

        const maxChannel = Math.max(0, ...Array.from(channelValues.keys()));
        if (maxChannel <= 0) {
            return;
        }

        const buffer: number[] = new Array(maxChannel + 2);
        buffer[0] = Math.floor(maxChannel / 256);
        buffer[1] = maxChannel % 256;
        for (let i = 1; i <= maxChannel; i++) {
            buffer[i + 1] = channelValues.get(i) ?? 0;
        }

        this.sendMessage({
            type: "Data",
            data: buffer,
        });
    }

    public override dispose(): void {
        this.bridge.unregisterController(this.id);
    }

    private sendConfiguration() {
        this.sendMessage({
            type: "UpdateConfiguration",
            port: this.config.port,
        });
    }
}
