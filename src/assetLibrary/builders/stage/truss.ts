/**
 * Parametric truss elements (feature 002, T069–T071): straight section, 90° corner and tower.
 * All parts are slot `metal`. Front faces +Z, bottom at y = 0.
 */
import type * as THREE from "three";
import { choiceParam, numberParam } from "../../params";
import type { BuilderKit, ParamValues, Vec3 } from "../../types";
import { buildTrussSection, TRUSS_PROFILES, TRUSS_WIDTH, trussHeight, type TrussProfile } from "./trussCommon";

export const CORNER_LEG = 0.5;
export const TOWER_BASE = 0.8;
export const TOWER_BASE_THICKNESS = 0.02;
export const TOWER_TOP_BLOCK = 0.35;

function profileOf(p: ParamValues): TrussProfile {
    return choiceParam(p, "profile", TRUSS_PROFILES, "square");
}

// ---------------------------------------------------------------------------------------------------------------
// stage.truss-straight: along X, centered on the origin
// ---------------------------------------------------------------------------------------------------------------

export function trussStraightSize(p: ParamValues): Vec3 {
    return [numberParam(p, "length", 2), trussHeight(profileOf(p)), TRUSS_WIDTH];
}

export function buildTrussStraight(p: ParamValues, kit: BuilderKit): THREE.Object3D {
    return buildTrussSection(kit, numberParam(p, "length", 2), profileOf(p));
}

// ---------------------------------------------------------------------------------------------------------------
// stage.truss-corner: corner block on the origin (documented corner anchor), legs along +X and +Z
// ---------------------------------------------------------------------------------------------------------------

/** Distance from the origin to the end of each leg. */
export const CORNER_REACH = TRUSS_WIDTH / 2 + CORNER_LEG;

export function trussCornerSize(p: ParamValues): Vec3 {
    const extent = TRUSS_WIDTH / 2 + CORNER_REACH;
    return [extent, trussHeight(profileOf(p)), extent];
}

export function buildTrussCorner(p: ParamValues, kit: BuilderKit): THREE.Object3D {
    const profile = profileOf(p);
    const root = kit.group("truss-corner");
    root.add(kit.box([TRUSS_WIDTH, trussHeight(profile), TRUSS_WIDTH], "metal"));

    const legCenter = TRUSS_WIDTH / 2 + CORNER_LEG / 2;
    const legX = buildTrussSection(kit, CORNER_LEG, profile);
    legX.position.x = legCenter;
    root.add(legX);

    // rotation by -90° about Y turns +X into +Z
    const legZ = buildTrussSection(kit, CORNER_LEG, profile);
    legZ.rotation.y = -Math.PI / 2;
    legZ.position.z = legCenter;
    root.add(legZ);

    return kit.mergeBySlot(root);
}

// ---------------------------------------------------------------------------------------------------------------
// stage.truss-tower: base plate, vertical square section, top block
// ---------------------------------------------------------------------------------------------------------------

export function trussTowerSize(p: ParamValues): Vec3 {
    return [TOWER_BASE, numberParam(p, "height", 3), TOWER_BASE];
}

export function buildTrussTower(p: ParamValues, kit: BuilderKit): THREE.Object3D {
    const height = numberParam(p, "height", 3);
    const root = kit.group("truss-tower");
    root.add(kit.box([TOWER_BASE, TOWER_BASE_THICKNESS, TOWER_BASE], "metal"));

    const sectionLength = Math.max(0.01, height - TOWER_BASE_THICKNESS - TOWER_TOP_BLOCK);
    const section = buildTrussSection(kit, sectionLength, "square");
    // rotation by +90° about Z turns +X into +Y; the profile (y 0…0.29) then lies at x -0.29…0, so shift it back
    section.rotation.z = Math.PI / 2;
    section.position.set(TRUSS_WIDTH / 2, TOWER_BASE_THICKNESS + sectionLength / 2, 0);
    root.add(section);

    const top = kit.box([TOWER_TOP_BLOCK, TOWER_TOP_BLOCK, TOWER_TOP_BLOCK], "metal");
    top.position.y = height - TOWER_TOP_BLOCK;
    root.add(top);

    return kit.mergeBySlot(root);
}
