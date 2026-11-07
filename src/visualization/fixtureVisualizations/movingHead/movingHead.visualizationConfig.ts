import { ChannelMapping } from "../types";

export interface MovingHeadVisualizationConfigRange {
    default: number;
    min: number;
    max: number;
}

export interface MovingHeadVisualizationConfig {
    channelMapping: {
        pan: ChannelMapping;
        tilt: ChannelMapping;
        beamAngle: ChannelMapping;
        red: number;
        green: number;
        blue: number;
    };
}
