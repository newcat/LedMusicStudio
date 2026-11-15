import type { MenuItem } from "primevue/menuitem";

export type AddKind = "box" | "cylinder" | "plane" | "sphere" | "group" | "dmxFixture" | "ledStrip" | "model" | "aimTarget";

/** Items of the Add menu, shared by the toolbar and the outliner header (feature 006). */
export function addMenuItems(onAdd: (kind: AddKind) => void): MenuItem[] {
    return [
        { label: "Box", icon: "mdi mdi-cube-outline", command: () => onAdd("box") },
        { label: "Cylinder", icon: "mdi mdi-cylinder", command: () => onAdd("cylinder") },
        { label: "Plane", icon: "mdi mdi-square-outline", command: () => onAdd("plane") },
        { label: "Sphere", icon: "mdi mdi-circle-outline", command: () => onAdd("sphere") },
        { label: "Group", icon: "mdi mdi-folder-outline", command: () => onAdd("group") },
        { separator: true },
        { label: "DMX fixture", icon: "mdi mdi-spotlight-beam", command: () => onAdd("dmxFixture") },
        { label: "LED strip", icon: "mdi mdi-led-strip-variant", command: () => onAdd("ledStrip") },
        { label: "Import model (GLB)…", icon: "mdi mdi-shape-outline", command: () => onAdd("model") },
        { separator: true },
        { label: "Aim target", icon: "mdi mdi-crosshairs", command: () => onAdd("aimTarget") },
    ];
}
