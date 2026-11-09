import * as THREE from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";

import fragmentShader from "./shaders/modifiedStandardMaterial.frag?raw";
import vertexShader from "./shaders/modifiedStandardMaterial.vert?raw";

/** What a strip renderer has to provide so that `LedStripLighting` can light surfaces with it. */
export interface LedStripSource {
    readonly matrixWorld: THREE.Matrix4;
    readonly parent: THREE.Object3D | null;
    readonly visible: boolean;
    /** Object-local endpoints. */
    getLocalStart(): THREE.Vector3;
    getLocalEnd(): THREE.Vector3;
    /** 128 colors, 0..255 per channel. */
    getColors(): ArrayLike<ArrayLike<number>>;
}

export interface LedStripUniform {
    start: THREE.Vector3;
    end: THREE.Vector3;
    direction: THREE.Vector3;
}

export interface LedStripUniforms extends Record<string, THREE.IUniform> {
    uNumLedStrips: { value: number };
    uLedStrips: { value: LedStripUniform[] };
    uLedStripColors: { value: THREE.Texture };
}

const COLORS_PER_STRIP = 128;

function isInVisibleHierarchy(obj: THREE.Object3D | null): boolean {
    let current = obj;
    while (current) {
        if (!current.visible) {
            return false;
        }
        current = current.parent;
    }
    return true;
}

/**
 * One per view (editor or show window). Owns the LED strip renderers and the uniforms that are shared by all
 * LED-lit materials of the view. `update()` has to be called once per frame before rendering.
 */
export class LedStripLighting {
    public static readonly MAX_INSTANCES = 8;

    public readonly uniforms: LedStripUniforms;

    private readonly strips: LedStripSource[] = [];
    private readonly texture: THREE.DataTexture;

    private readonly tmpStart = new THREE.Vector3();
    private readonly tmpEnd = new THREE.Vector3();
    private readonly tmpQuat = new THREE.Quaternion();
    private readonly tmpScale = new THREE.Vector3();
    private readonly tmpPos = new THREE.Vector3();

    public constructor() {
        const max = LedStripLighting.MAX_INSTANCES;
        this.texture = new THREE.DataTexture(new Uint8Array(max * COLORS_PER_STRIP * 4), COLORS_PER_STRIP, max);
        const strips: LedStripUniform[] = [];
        for (let i = 0; i < max; i++) {
            strips.push({ start: new THREE.Vector3(), end: new THREE.Vector3(), direction: new THREE.Vector3(1, 0, 0) });
        }
        this.uniforms = {
            uNumLedStrips: { value: 0 },
            uLedStrips: { value: strips },
            uLedStripColors: { value: this.texture },
        };
    }

    public addStrip(strip: LedStripSource) {
        if (!this.strips.includes(strip)) {
            this.strips.push(strip);
        }
    }

    public removeStrip(strip: LedStripSource) {
        const index = this.strips.indexOf(strip);
        if (index !== -1) {
            this.strips.splice(index, 1);
        }
    }

    public update() {
        const data = this.texture.image.data as Uint8Array;
        const uStrips = this.uniforms.uLedStrips.value;
        let count = 0;

        for (const strip of this.strips) {
            if (count >= LedStripLighting.MAX_INSTANCES) {
                break;
            }
            if (!isInVisibleHierarchy(strip.parent) || !strip.visible) {
                continue;
            }
            const u = uStrips[count];
            u.start.copy(strip.getLocalStart()).applyMatrix4(strip.matrixWorld);
            u.end.copy(strip.getLocalEnd()).applyMatrix4(strip.matrixWorld);
            // direction is local +Y rotated into world space
            strip.matrixWorld.decompose(this.tmpPos, this.tmpQuat, this.tmpScale);
            u.direction.set(0, 1, 0).applyQuaternion(this.tmpQuat).normalize();

            const colors = strip.getColors();
            for (let ci = 0; ci < COLORS_PER_STRIP; ci++) {
                const color = colors[ci];
                const offset = (count * COLORS_PER_STRIP + ci) * 4;
                data[offset] = color ? color[0] : 0;
                data[offset + 1] = color ? color[1] : 0;
                data[offset + 2] = color ? color[2] : 0;
                data[offset + 3] = 255;
            }
            count++;
        }

        this.uniforms.uNumLedStrips.value = count;
        this.texture.needsUpdate = true;
    }

    public dispose() {
        this.strips.length = 0;
        this.texture.dispose();
    }
}

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

export function createLedLitMaterial(lighting: LedStripLighting, params: LedLitMaterialParams = {}): LedLitMaterial {
    const defined: Record<string, unknown> = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
    if (params.sheen) {
        defined.sheenColor ??= params.color ?? 0xffffff;
        defined.sheenRoughness ??= 0.8;
    }
    if (params.clearcoat) {
        defined.clearcoatRoughness ??= 0.1;
    }
    return new CustomShaderMaterial<typeof THREE.MeshPhysicalMaterial>({
        baseMaterial: THREE.MeshPhysicalMaterial,
        uniforms: lighting.uniforms,
        vertexShader,
        fragmentShader,
        roughness: 0.8,
        metalness: 0,
        ...defined,
    });
}

/** Converts imported glTF materials. Other material types are returned unchanged. */
export function convertToLedLit(lighting: LedStripLighting, material: THREE.Material): THREE.Material {
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
