export type Fixture = {
    [k: string]: unknown;
} & {
    $schema: "https://raw.githubusercontent.com/OpenLightingProject/open-fixture-library/master/schemas/fixture.json";
    /**
     * unique in manufacturer
     */
    name: string;
    /**
     * unique globally; if not set: use name
     */
    shortName?: string;
    /**
     * most important category first
     *
     * @minItems 1
     */
    categories: [
        (
            | "Barrel Scanner"
            | "Blinder"
            | "Color Changer"
            | "Dimmer"
            | "Effect"
            | "Fan"
            | "Flower"
            | "Hazer"
            | "Laser"
            | "Matrix"
            | "Moving Head"
            | "Pixel Bar"
            | "Scanner"
            | "Smoke"
            | "Stand"
            | "Strobe"
            | "Other"
        ),
        ...(
            | "Barrel Scanner"
            | "Blinder"
            | "Color Changer"
            | "Dimmer"
            | "Effect"
            | "Fan"
            | "Flower"
            | "Hazer"
            | "Laser"
            | "Matrix"
            | "Moving Head"
            | "Pixel Bar"
            | "Scanner"
            | "Smoke"
            | "Stand"
            | "Strobe"
            | "Other"
        )[]
    ];
    meta: {
        /**
         * @minItems 1
         */
        authors: [string, ...string[]];
        createDate: string;
        lastModifyDate: string;
        importPlugin?: {
            plugin: string;
            date: string;
            comment?: string;
        };
    };
    comment?: string;
    links?: {
        [k: string]: unknown;
    };
    helpWanted?: string;
    rdm?: {
        modelId: number;
        softwareVersion?: string;
    };
    physical?: Physical;
    matrix?: Matrix;
    wheels?: {
        [k: string]: {
            direction?: "CW" | "CCW";
            /**
             * @minItems 2
             */
            slots: [WheelSlot, WheelSlot, ...WheelSlot[]];
        };
    };
    availableChannels?: {
        [k: string]: Channel;
    };
    templateChannels?: {
        [k: string]: {
            [k: string]: unknown;
        };
    };
    /**
     * @minItems 1
     */
    modes: [
        {
            name: string & {
                [k: string]: unknown;
            };
            shortName?: string & {
                [k: string]: unknown;
            };
            rdmPersonalityIndex?: number;
            physical?: Physical;
            /**
             * @minItems 1
             */
            channels: [
                (
                    | null
                    | string
                    | {
                          insert: "matrixChannels";
                          repeatFor:
                              | (
                                    | "eachPixelABC"
                                    | "eachPixelXYZ"
                                    | "eachPixelXZY"
                                    | "eachPixelYXZ"
                                    | "eachPixelYZX"
                                    | "eachPixelZXY"
                                    | "eachPixelZYX"
                                    | "eachPixelGroup"
                                )
                              | [string, ...string[]];
                          channelOrder: "perPixel" | "perChannel";
                          /**
                           * @minItems 1
                           */
                          templateChannels: [null | string, ...(null | string)[]];
                      }
                ),
                ...(
                    | null
                    | string
                    | {
                          insert: "matrixChannels";
                          repeatFor:
                              | (
                                    | "eachPixelABC"
                                    | "eachPixelXYZ"
                                    | "eachPixelXZY"
                                    | "eachPixelYXZ"
                                    | "eachPixelYZX"
                                    | "eachPixelZXY"
                                    | "eachPixelZYX"
                                    | "eachPixelGroup"
                                )
                              | [string, ...string[]];
                          channelOrder: "perPixel" | "perChannel";
                          /**
                           * @minItems 1
                           */
                          templateChannels: [null | string, ...(null | string)[]];
                      }
                )[]
            ];
        },
        ...{
            name: string & {
                [k: string]: unknown;
            };
            shortName?: string & {
                [k: string]: unknown;
            };
            rdmPersonalityIndex?: number;
            physical?: Physical;
            /**
             * @minItems 1
             */
            channels: [
                (
                    | null
                    | string
                    | {
                          insert: "matrixChannels";
                          repeatFor:
                              | (
                                    | "eachPixelABC"
                                    | "eachPixelXYZ"
                                    | "eachPixelXZY"
                                    | "eachPixelYXZ"
                                    | "eachPixelYZX"
                                    | "eachPixelZXY"
                                    | "eachPixelZYX"
                                    | "eachPixelGroup"
                                )
                              | [string, ...string[]];
                          channelOrder: "perPixel" | "perChannel";
                          /**
                           * @minItems 1
                           */
                          templateChannels: [null | string, ...(null | string)[]];
                      }
                ),
                ...(
                    | null
                    | string
                    | {
                          insert: "matrixChannels";
                          repeatFor:
                              | (
                                    | "eachPixelABC"
                                    | "eachPixelXYZ"
                                    | "eachPixelXZY"
                                    | "eachPixelYXZ"
                                    | "eachPixelYZX"
                                    | "eachPixelZXY"
                                    | "eachPixelZYX"
                                    | "eachPixelGroup"
                                )
                              | [string, ...string[]];
                          channelOrder: "perPixel" | "perChannel";
                          /**
                           * @minItems 1
                           */
                          templateChannels: [null | string, ...(null | string)[]];
                      }
                )[]
            ];
        }[]
    ];
};
/**
 * width, height, depth (in mm)
 *
 * @minItems 3
 * @maxItems 3
 */
export type DimensionsXYZ = [number, number, number];
export type Matrix = {
    /**
     * amount of pixels in X, Y and Z directions
     *
     * @minItems 3
     * @maxItems 3
     */
    pixelCount?: [number, number, number];
    /**
     * pixelKeys in a structure of arrays for the Z, Y and X directions
     *
     * @minItems 1
     */
    pixelKeys?: [
        [[string | null, ...(string | null)[]], ...[string | null, ...(string | null)[]][]],
        ...[[string | null, ...(string | null)[]], ...[string | null, ...(string | null)[]][]][]
    ];
    pixelGroups?: {
        [k: string]:
            | [string, ...string[]]
            | "all"
            | {
                  x?: PixelNumberConstraintArray;
                  y?: PixelNumberConstraintArray;
                  z?: PixelNumberConstraintArray;
                  /**
                   * @minItems 1
                   */
                  name?: [string, ...string[]];
              };
    };
} & {
    [k: string]: unknown;
};
/**
 * @minItems 1
 */
export type PixelNumberConstraintArray = [
    string | string | string | string | string | "even" | "odd",
    ...(string | string | string | string | string | "even" | "odd")[]
];
export type WheelSlot =
    | {
          type: "Open";
      }
    | {
          type: "Closed";
      }
    | {
          type: "Color";
          name?: string;
          /**
           * @minItems 1
           */
          colors?: [string, ...string[]];
          colorTemperature?: string | ("warm" | "CTO" | "default" | "cold" | "CTB");
      }
    | {
          type: "Gobo";
          resource?: string;
          name?: string;
      }
    | {
          type: "Prism";
          name?: string;
          facets?: number;
      }
    | {
          type: "Iris";
          openPercent?: string | ("closed" | "open");
      }
    | {
          type: "Frost";
          frostIntensity?: string | ("off" | "low" | "high");
      }
    | {
          type: "AnimationGoboStart";
          name?: string;
      }
    | {
          type: "AnimationGoboEnd";
      };
export type Channel = {
    [k: string]: unknown;
} & {
    /**
     * if not set: use channel key
     */
    name?: string;
    /**
     * @minItems 1
     */
    fineChannelAliases?: [string | string, ...(string | string)[]];
    dmxValueResolution?: "8bit" | "16bit" | "24bit";
    defaultValue?: number | string;
    highlightValue?: number | string;
    constant?: boolean;
    precedence?: "LTP" | "HTP";
    capability?: Capability;
    /**
     * @minItems 2
     */
    capabilities?: [Capability, Capability, ...Capability[]];
};
export type Capability =
    | {
          dmxRange?: DmxRange;
          type: "NoFunction";
          comment?: string;
          helpWanted?: string;
          menuClick?: "start" | "center" | "end" | "hidden";
          switchChannels?: SwitchChannels;
      }
    | {
          dmxRange?: DmxRange;
          type: "ShutterStrobe";
          shutterEffect: "Open" | "Closed" | "Strobe" | "Pulse" | "RampUp" | "RampDown" | "RampUpDown" | "Lightning" | "Spikes" | "Burst";
          soundControlled?: boolean;
          speed?: string | ("fast" | "slow" | "stop" | "slow reverse" | "fast reverse");
          speedStart?: string | ("fast" | "slow" | "stop" | "slow reverse" | "fast reverse");
          speedEnd?: string | ("fast" | "slow" | "stop" | "slow reverse" | "fast reverse");
          duration?: string | ("instant" | "short" | "long");
          durationStart?: string | ("instant" | "short" | "long");
          durationEnd?: string | ("instant" | "short" | "long");
          randomTiming?: boolean;
          comment?: string;
          helpWanted?: string;
          menuClick?: "start" | "center" | "end" | "hidden";
          switchChannels?: SwitchChannels;
      }
    | {
          [k: string]: unknown;
      }
    | {
          dmxRange?: DmxRange;
          type: "Intensity";
          brightness?: string | ("off" | "dark" | "bright");
          brightnessStart?: string | ("off" | "dark" | "bright");
          brightnessEnd?: string | ("off" | "dark" | "bright");
          comment?: string;
          helpWanted?: string;
          menuClick?: "start" | "center" | "end" | "hidden";
          switchChannels?: SwitchChannels;
      }
    | {
          dmxRange?: DmxRange;
          type: "ColorIntensity";
          color:
              | "Red"
              | "Green"
              | "Blue"
              | "Cyan"
              | "Magenta"
              | "Yellow"
              | "Amber"
              | "White"
              | "Warm White"
              | "Cold White"
              | "UV"
              | "Lime"
              | "Indigo";
          brightness?: string | ("off" | "dark" | "bright");
          brightnessStart?: string | ("off" | "dark" | "bright");
          brightnessEnd?: string | ("off" | "dark" | "bright");
          comment?: string;
          helpWanted?: string;
          menuClick?: "start" | "center" | "end" | "hidden";
          switchChannels?: SwitchChannels;
      }
    | {
          dmxRange?: DmxRange;
          type: "ColorPreset";
          comment?: string;
          /**
           * @minItems 1
           */
          colors?: [string, ...string[]];
          /**
           * @minItems 1
           */
          colorsStart?: [string, ...string[]];
          /**
           * @minItems 1
           */
          colorsEnd?: [string, ...string[]];
          colorTemperature?: string | ("warm" | "CTO" | "default" | "cold" | "CTB");
          colorTemperatureStart?: string | ("warm" | "CTO" | "default" | "cold" | "CTB");
          colorTemperatureEnd?: string | ("warm" | "CTO" | "default" | "cold" | "CTB");
          helpWanted?: string;
          menuClick?: "start" | "center" | "end" | "hidden";
          switchChannels?: SwitchChannels;
      }
    | {
          dmxRange?: DmxRange;
          type: "WheelShake";
          wheel?: unknown;
          isShaking?: "wheel" | "slot";
          slotNumber?: number;
          slotNumberStart?: number;
          slotNumberEnd?: number;
          shakeSpeed?: string | ("fast" | "slow" | "stop" | "slow reverse" | "fast reverse");
          shakeSpeedStart?: string | ("fast" | "slow" | "stop" | "slow reverse" | "fast reverse");
          shakeSpeedEnd?: string | ("fast" | "slow" | "stop" | "slow reverse" | "fast reverse");
          shakeAngle?: string | ("closed" | "narrow" | "wide");
          shakeAngleStart?: string | ("closed" | "narrow" | "wide");
          shakeAngleEnd?: string | ("closed" | "narrow" | "wide");
          comment?: string;
          helpWanted?: string;
          menuClick?: "start" | "center" | "end" | "hidden";
          switchChannels?: SwitchChannels;
      }
    | {
          dmxRange?: DmxRange;
          type: "IrisEffect";
          effectName: string;
          speed?: string | ("fast" | "slow" | "stop" | "slow reverse" | "fast reverse");
          speedStart?: string | ("fast" | "slow" | "stop" | "slow reverse" | "fast reverse");
          speedEnd?: string | ("fast" | "slow" | "stop" | "slow reverse" | "fast reverse");
          comment?: string;
          helpWanted?: string;
          menuClick?: "start" | "center" | "end" | "hidden";
          switchChannels?: SwitchChannels;
      }
    | {
          dmxRange?: DmxRange;
          type: "FrostEffect";
          effectName: string;
          speed?: string | ("fast" | "slow" | "stop" | "slow reverse" | "fast reverse");
          speedStart?: string | ("fast" | "slow" | "stop" | "slow reverse" | "fast reverse");
          speedEnd?: string | ("fast" | "slow" | "stop" | "slow reverse" | "fast reverse");
          comment?: string;
          helpWanted?: string;
          menuClick?: "start" | "center" | "end" | "hidden";
          switchChannels?: SwitchChannels;
      }
    | {
          dmxRange?: DmxRange;
          type: "Prism";
          speed?: string | ("fast CW" | "slow CW" | "stop" | "slow CCW" | "fast CCW");
          speedStart?: string | ("fast CW" | "slow CW" | "stop" | "slow CCW" | "fast CCW");
          speedEnd?: string | ("fast CW" | "slow CW" | "stop" | "slow CCW" | "fast CCW");
          angle?: string;
          angleStart?: string;
          angleEnd?: string;
          comment?: string;
          helpWanted?: string;
          menuClick?: "start" | "center" | "end" | "hidden";
          switchChannels?: SwitchChannels;
      }
    | {
          dmxRange?: DmxRange;
          type: "Fog";
          fogType?: "Fog" | "Haze";
          fogOutput?: string | ("off" | "weak" | "strong");
          fogOutputStart?: string | ("off" | "weak" | "strong");
          fogOutputEnd?: string | ("off" | "weak" | "strong");
          comment?: string;
          helpWanted?: string;
          menuClick?: "start" | "center" | "end" | "hidden";
          switchChannels?: SwitchChannels;
      }
    | {
          dmxRange?: DmxRange;
          type: "FogType";
          fogType: "Fog" | "Haze";
          comment?: string;
          helpWanted?: string;
          menuClick?: "start" | "center" | "end" | "hidden";
          switchChannels?: SwitchChannels;
      }
    | {
          dmxRange?: DmxRange;
          type: "Maintenance";
          parameter?: number | string | ("off" | "low" | "high" | "slow" | "fast" | "small" | "big" | "instant" | "short" | "long");
          parameterStart?: number | string | ("off" | "low" | "high" | "slow" | "fast" | "small" | "big" | "instant" | "short" | "long");
          parameterEnd?: number | string | ("off" | "low" | "high" | "slow" | "fast" | "small" | "big" | "instant" | "short" | "long");
          hold?: string | ("instant" | "short" | "long");
          comment?: string;
          helpWanted?: string;
          menuClick?: "start" | "center" | "end" | "hidden";
          switchChannels?: SwitchChannels;
      }
    | {
          dmxRange?: DmxRange;
          type: "Generic";
          comment?: string;
          helpWanted?: string;
          menuClick?: "start" | "center" | "end" | "hidden";
          switchChannels?: SwitchChannels;
      };
/**
 * @minItems 2
 * @maxItems 2
 */
export type DmxRange = [number, number];

export interface Physical {
    dimensions?: DimensionsXYZ;
    /**
     * in kg
     */
    weight?: number;
    /**
     * in W
     */
    power?: number;
    DMXconnector?:
        | "3-pin"
        | "3-pin (swapped +/-)"
        | "3-pin XLR IP65"
        | "5-pin"
        | "5-pin XLR IP65"
        | "3-pin and 5-pin"
        | "3.5mm stereo jack";
    bulb?: {
        /**
         * e.g. 'LED'
         */
        type?: string;
        /**
         * in K
         */
        colorTemperature?: number;
        lumens?: number;
    };
    lens?: {
        /**
         * e.g. 'PC', 'Fresnel'
         */
        name?: string;
        /**
         * @minItems 2
         * @maxItems 2
         */
        degreesMinMax?: [number, number];
    };
    matrixPixels?: {
        dimensions?: DimensionsXYZ;
        spacing?: DimensionsXYZ;
    };
}
export interface SwitchChannels {
    [k: string]: string;
}

export interface OFLManufacturers {
    [k: string]: {
        name: string;
        comment?: string;
        website?: string;
        rdmId?: number;
    };
}
