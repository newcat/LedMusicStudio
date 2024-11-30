import { ChannelMapping } from "../types";

export interface MovingHeadVisualizationConfigRange {
    default: number;
    min: number;
    max: number;
}

export interface MovingHeadVisualizationConfig {
    position: [number, number, number];
    rotation: [number, number, number];
    channelMapping: {
        pan: ChannelMapping;
        tilt: ChannelMapping;
        beamAngle: ChannelMapping;
        red: number;
        green: number;
        blue: number;
    };
}
