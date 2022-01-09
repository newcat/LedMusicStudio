export type DragDirection = "left" | "right" | "both";
export type ItemArea = "leftHandle" | "center" | "rightHandle";

export interface IMarker {
    type: "major" | "minor";
    unit: number;
    position: number;
}
