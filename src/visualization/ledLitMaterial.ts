import * as THREE from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";

import type { SurfaceLighting } from "./lighting/surfaceLighting";
import fragmentShader from "./lighting/shaders/surfaceLighting.frag?raw";
import vertexShader from "./lighting/shaders/surfaceLighting.vert?raw";

export interface LedLitMaterialParams {
    color?: THREE.ColorRepresentation;
    map?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
    roughnessMap?: THREE.Texture | null;
    metalnessMap?: THREE.Texture | null;
    emissive?: THREE.ColorRepresentation;
    emissiveMap?: THREE.Texture | null;
    aoMap?: THREE.Texture | null;
    roughness?: number;
    metalness?: number;
    transparent?: boolean;
    opacity?: number;
    side?: THREE.Side;
    /** Fabric look. `sheenColor` defaults to `color`, `sheenRoughness` to 0.8. */
    sheen?: number;
    sheenColor?: THREE.ColorRepresentation;
    sheenRoughness?: number;
    /** Glossy plastic look. `clearcoatRoughness` defaults to 0.1. */
    clearcoat?: number;
    clearcoatRoughness?: number;
    /** Dielectric specular strength (1 = physical default); fabrics use less so black cloth stays black. */
    specularIntensity?: number;
}

export type LedLitMaterial = CustomShaderMaterial<typeof THREE.MeshPhysicalMaterial>;

/**
 * A physical material lit by the view's `SurfaceLighting` (fixture lights and LED strips) in addition to the
 * regular three.js lights. All materials of a view share the lighting's uniforms; the lighting's defines (loop
 * sizes) are merged into the material's own defines and follow quality changes through `registerMaterial`.
 */
export function createLedLitMaterial(lighting: SurfaceLighting, params: LedLitMaterialParams = {}): LedLitMaterial {
    const defined: Record<string, unknown> = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
    if (params.sheen) {
        defined.sheenColor ??= params.color ?? 0xffffff;
        defined.sheenRoughness ??= 0.8;
    }
    if (params.clearcoat) {
        defined.clearcoatRoughness ??= 0.1;
    }
    const material = new CustomShaderMaterial<typeof THREE.MeshPhysicalMaterial>({
        baseMaterial: THREE.MeshPhysicalMaterial,
        uniforms: lighting.uniforms,
        vertexShader,
        fragmentShader,
        roughness: 0.8,
        metalness: 0,
        ...defined,
    });
    // not passed as a constructor option: that would replace the STANDARD/PHYSICAL defines of the base material
    lighting.registerMaterial(material);
    return material;
}

/** Converts imported glTF materials. Other material types are returned unchanged. */
export function convertToLedLit(lighting: SurfaceLighting, material: THREE.Material): THREE.Material {
    if (!(material instanceof THREE.MeshStandardMaterial)) {
        return material;
    }
    return createLedLitMaterial(lighting, {
        color: material.color.clone(),
        map: material.map,
        normalMap: material.normalMap,
        roughnessMap: material.roughnessMap,
        metalnessMap: material.metalnessMap,
        emissive: material.emissive.clone(),
        emissiveMap: material.emissiveMap,
        aoMap: material.aoMap,
        roughness: material.roughness,
        metalness: material.metalness,
        transparent: material.transparent,
        opacity: material.opacity,
        side: material.side,
    });
}
