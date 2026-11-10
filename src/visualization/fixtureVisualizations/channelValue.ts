import type { ChannelMapping } from "./types";

/**
 * Value of a mapped DMX channel. A plain channel index returns the raw DMX value (0 if unmapped); a ChannelMapping
 * maps 0..255 linearly to min..max and returns `defaultValue` when the channel is unmapped or has no value.
 */
export function getChannelValue(channelOrMapping: number | ChannelMapping, channelValues: ArrayLike<number>): number {
    const channel = typeof channelOrMapping === "number" ? channelOrMapping : channelOrMapping.channel;
    const defaultValue = typeof channelOrMapping === "number" ? 0 : channelOrMapping.defaultValue;
    if (channel < 0) {
        return defaultValue;
    }

    const channelValue = channelValues[channel];
    if (channelValue === undefined) {
        return defaultValue;
    }
    if (typeof channelOrMapping === "number") {
        return channelValue;
    }
    return (channelValue / 255) * (channelOrMapping.max - channelOrMapping.min) + channelOrMapping.min;
}
