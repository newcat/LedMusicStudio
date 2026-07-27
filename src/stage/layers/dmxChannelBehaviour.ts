import { DmxFixture } from "../fixtures";
import { Capability, Channel as OpenFixtureChannel } from "../fixtures/dmx/open-fixture";

/**
 * Whether a DMX channel can be meaningfully interpolated when layers are composited.
 *
 * - `continuous` — an amount of something (dimmer, colour intensity). Layer opacity and blend modes apply normally.
 * - `discrete` — a selection: gobo index, colour wheel slot, program, mode. Halfway between gobo 3 and gobo 7 is not a gobo, so
 *   these channels ignore blend modes entirely and are simply won outright by the topmost layer that writes them.
 *
 * This is derived from the Open Fixture Library `precedence` field, which already encodes the standard DMX console distinction
 * (`HTP` for intensity-style channels, `LTP` for everything else), falling back to the channel's capability types.
 *
 * Note that `continuous` does *not* mean we implement HTP max-takes-all semantics — the default blend mode is `normal`, so the
 * topmost layer still wins by default. It only means interpolation is permitted when a layer asks for it.
 */
export type ChannelBlendBehaviour = "continuous" | "discrete";

/**
 * Capability types treated as continuous when the definition has no explicit `precedence`. Deliberately narrow: these are the
 * two types that unambiguously mean "amount of light". Pan/tilt, zoom and strobe are numerically continuous but are
 * conventionally LTP, and anything unrecognised is safer left un-interpolated.
 */
const CONTINUOUS_CAPABILITY_TYPES = new Set<Capability["type"]>(["Intensity", "ColorIntensity"]);

function inferBehaviour(channel: OpenFixtureChannel | null): ChannelBlendBehaviour {
    if (!channel) {
        return "discrete";
    }
    if (channel.precedence) {
        return channel.precedence === "HTP" ? "continuous" : "discrete";
    }

    const capabilities: Capability[] = channel.capabilities ?? (channel.capability ? [channel.capability] : []);
    if (capabilities.length === 0) {
        return "discrete";
    }
    return capabilities.every((c) => CONTINUOUS_CAPABILITY_TYPES.has(c.type)) ? "continuous" : "discrete";
}

/** Blend behaviour per channel of the fixture's selected mode, in channel order. */
export function getChannelBlendBehaviours(fixture: DmxFixture): ChannelBlendBehaviour[] {
    return fixture.resolvedChannels.map((c) => inferBehaviour(c.definition));
}
