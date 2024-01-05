import { BaseFixture, FixtureType } from "./base.fixture";
import { DmxFixture } from "./dmx";
import { LedStripFixture } from "./ledStrip/ledStrip.fixture";

export function createFixture(type: FixtureType): BaseFixture {
    switch (type) {
        case FixtureType.LED_STRIP:
            return new LedStripFixture();
        case FixtureType.DMX:
            return new DmxFixture();
        default:
            throw new Error(`Unknown fixture type ${type}`);
    }
}
