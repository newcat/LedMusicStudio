import * as THREE from "three";

import BEAM_VERTEX_SHADER from "./beam.vertex.glsl?raw";
import BEAM_FRAGMENT_SHADER from "./beam.fragment.glsl?raw";

/**
 * Material and geometry of the volumetric beam cone (feature 003, research R8). The beam runs along the mesh's local
 * +Z from the lens (z = 0) to `uLength`; hang the mesh directly on `body.beamAnchor` (no extra rotation/offset).
 * Lengths (`topRadius`, `uLength`) are in mesh-local units, so divide world meters by the anchor's world scale.
 */

/** Largest prism facet count (contracts: prismFacets 3..8). */
export const MAX_PRISM_FACETS = 8;
/** Loop bound of the haze octaves in the fragment shader (BEAM_MAX_OCTAVES). */
export const MAX_HAZE_OCTAVES = 4;

export interface BeamUniforms {
    [name: string]: THREE.IUniform;
    /** Linear RGB, not multiplied by intensity. */
    color: THREE.IUniform<THREE.Color>;
    /** Full beam angle, degrees. */
    angle: THREE.IUniform<number>;
    /** Lens radius, mesh-local units. */
    topRadius: THREE.IUniform<number>;
    /** Seconds; drives the haze noise. */
    time: THREE.IUniform<number>;
    /** Haze noise scale (larger = bigger swirls). */
    fogFactor: THREE.IUniform<number>;
    /** Haze noise speed. */
    fogTurbulence: THREE.IUniform<number>;
    /** 0..1 final intensity. */
    uIntensity: THREE.IUniform<number>;
    /** Beam length (first hit of the center ray), mesh-local units; the last 5 % fade out. */
    uLength: THREE.IUniform<number>;
    /** Effective haze 0..1 (frame.haze). */
    uHaze: THREE.IUniform<number>;
    /** int 1..MAX_HAZE_OCTAVES (quality.hazeOctaves). */
    uHazeOctaves: THREE.IUniform<number>;
    /** lighting.gobos.texture */
    uGoboAtlas: THREE.IUniform<THREE.Texture | null>;
    /** Atlas tile, −1 = open. */
    uGoboTile: THREE.IUniform<number>;
    /** Radians. */
    uGoboRotation: THREE.IUniform<number>;
    /** Second half color of a split slot (linear RGB). */
    uSplitColor: THREE.IUniform<THREE.Color>;
    uHasSplit: THREE.IUniform<boolean>;
    /** Prism facets; < 3 = no prism (only instance 0 draws). */
    uFacets: THREE.IUniform<number>;
    /** Outward tilt per facet, degrees. */
    uPrismSpread: THREE.IUniform<number>;
    /** Radians. */
    uPrismRotation: THREE.IUniform<number>;
    /** lighting.shadowAtlasTexture (research R11). */
    uShadowAtlas: THREE.IUniform<THREE.Texture | null>;
    /** Shadow tile of the beam's light, −1 = none (beam not cut off). */
    uShadowTile: THREE.IUniform<number>;
    /** View-projection matrix of the shadow tile. */
    uShadowMatrix: THREE.IUniform<THREE.Matrix4>;
}

export type BeamMaterial = THREE.ShaderMaterial & { uniforms: BeamUniforms };

export function createBeamUniforms(): BeamUniforms {
    return {
        color: { value: new THREE.Color(1, 1, 1) },
        angle: { value: 15 },
        topRadius: { value: 0.06 },
        time: { value: 0 },
        fogFactor: { value: 1 },
        fogTurbulence: { value: 1 },
        uIntensity: { value: 1 },
        uLength: { value: 30 },
        uHaze: { value: 0.5 },
        uHazeOctaves: { value: 2 },
        uGoboAtlas: { value: null },
        uGoboTile: { value: -1 },
        uGoboRotation: { value: 0 },
        uSplitColor: { value: new THREE.Color(1, 1, 1) },
        uHasSplit: { value: false },
        uFacets: { value: 0 },
        uPrismSpread: { value: 6 },
        uPrismRotation: { value: 0 },
        uShadowAtlas: { value: null },
        uShadowTile: { value: -1 },
        uShadowMatrix: { value: new THREE.Matrix4() },
    };
}

/** Additive, transparent, no depth write, double sided, clipping planes honored. */
export function createBeamMaterial(goboAtlas: THREE.Texture | null = null, shadowAtlas: THREE.Texture | null = null): BeamMaterial {
    const uniforms = createBeamUniforms();
    uniforms.uGoboAtlas.value = goboAtlas;
    uniforms.uShadowAtlas.value = shadowAtlas;
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        clipping: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: BEAM_VERTEX_SHADER,
        fragmentShader: BEAM_FRAGMENT_SHADER,
        fog: false,
        toneMapped: false,
        dithering: false,
        uniforms,
    }) as BeamMaterial;
}

/**
 * Open cone shell as an `InstancedBufferGeometry`: `position.xy` is the unit circle direction, `position.z` 0 at the
 * lens and 1 at the far end (the vertex shader scales it by `topRadius`, `angle` and `uLength`). Instance attribute
 * `aFacet` = facet index 0..max(1, facets)−1; `instanceCount` = max(1, facets). Instances the shader does not need
 * (index ≥ `uFacets`, or > 0 without prism) draw nothing, so a geometry built for MAX_PRISM_FACETS can stay while
 * the facet count changes (or use `setBeamFacets` to skip their vertex work).
 *
 * The bounding sphere is infinite because the shader displaces the vertices; the mesh is never frustum culled.
 */
export function createBeamGeometry(radialSegments: number, facets: number): THREE.InstancedBufferGeometry {
    const segments = Math.max(3, Math.floor(radialSegments));
    const instances = Math.max(1, Math.min(MAX_PRISM_FACETS, Math.floor(facets)));

    const ringSize = segments + 1; // duplicated seam vertex for continuous uv
    const positions = new Float32Array(ringSize * 2 * 3);
    const uvs = new Float32Array(ringSize * 2 * 2);
    for (let ring = 0; ring < 2; ring++) {
        for (let i = 0; i < ringSize; i++) {
            const u = i / segments;
            const theta = u * Math.PI * 2;
            const v = ring * ringSize + i;
            positions[v * 3] = Math.cos(theta);
            positions[v * 3 + 1] = Math.sin(theta);
            positions[v * 3 + 2] = ring;
            uvs[v * 2] = u;
            uvs[v * 2 + 1] = ring;
        }
    }
    const indices: number[] = [];
    for (let i = 0; i < segments; i++) {
        const a = i;
        const b = i + 1;
        const c = ringSize + i;
        const d = ringSize + i + 1;
        indices.push(a, c, b, b, c, d);
    }

    const facetIndex = new Float32Array(instances);
    for (let i = 0; i < instances; i++) {
        facetIndex[i] = i;
    }

    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute("aFacet", new THREE.InstancedBufferAttribute(facetIndex, 1));
    geometry.instanceCount = instances;
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    return geometry;
}

/** Draws `facets` instances (1 without prism), clamped to the instances the geometry was built with. */
export function setBeamFacets(geometry: THREE.InstancedBufferGeometry, facets: number): void {
    const available = (geometry.getAttribute("aFacet") as THREE.InstancedBufferAttribute).count;
    geometry.instanceCount = facets >= 3 ? Math.min(available, Math.floor(facets)) : 1;
}
