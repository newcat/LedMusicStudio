import type { SceneObject } from "../model/types";

/** MDI icon class of an object kind, shared by the outliner rows and the inspector header. */
export function iconFor(obj: SceneObject): string {
    switch (obj.kind) {
        case "shape":
            return { box: "mdi-cube-outline", cylinder: "mdi-cylinder", plane: "mdi-square-outline", sphere: "mdi-circle-outline" }[obj.shape];
        case "fixtureVisualization":
            return "mdi-lightbulb-on-outline";
        case "importedModel":
            return "mdi-shape-outline";
        case "group":
            return "mdi-folder-outline";
        case "libraryAsset":
            return "mdi-package-variant-closed";
        case "aimTarget":
            return "mdi-crosshairs";
        default:
            return "mdi-help-box-outline";
    }
}
