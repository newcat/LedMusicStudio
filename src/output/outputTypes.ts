export enum OutputType {
    DUMMY,
    WLED,
    DMX,
    RAZER_CHROMA,
}

export interface OutputTypeMetadata {
    type: OutputType;
    name: string;
    icon: string;
}

export const OUTPUT_TYPES: Array<OutputTypeMetadata> = [
    { type: OutputType.DUMMY, name: "Dummy", icon: "mdi mdi-checkbox-blank-circle-outline" },
    { type: OutputType.WLED, name: "WLED", icon: "mdi mdi-led-on" },
    { type: OutputType.DMX, name: "DMX", icon: "mdi mdi-audio-input-xlr" },
    { type: OutputType.RAZER_CHROMA, name: "Razer Chroma", icon: "mdi mdi-keyboard" },
];
