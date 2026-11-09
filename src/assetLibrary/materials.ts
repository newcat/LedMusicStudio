/**
 * Material presets and slot styles (feature 002, research R14).
 * Presets are parameter sets for the LED-lit material; no textures.
 */
import type { AssetDefinition, MaterialPreset, MaterialPresetId, MaterialSlot } from "./types";

export const MATERIAL_PRESETS: Record<MaterialPresetId, MaterialPreset> = {
    "stage-floor-black": { id: "stage-floor-black", name: "Black stage floor", color: "#161616", roughness: 0.5, metalness: 0 },
    wood: { id: "wood", name: "Wood", color: "#8a5a35", roughness: 0.6, metalness: 0 },
    "metal-brushed": { id: "metal-brushed", name: "Brushed metal", color: "#b8bcc2", roughness: 0.35, metalness: 1 },
    "fabric-black": { id: "fabric-black", name: "Black fabric", color: "#080808", roughness: 1, metalness: 0, sheen: 1, specularIntensity: 0.1 },
    "fabric-white": { id: "fabric-white", name: "White fabric", color: "#e8e8e8", roughness: 1, metalness: 0, sheen: 1, specularIntensity: 0.1 },
    concrete: { id: "concrete", name: "Concrete", color: "#75736e", roughness: 0.95, metalness: 0 },
    "plastic-glossy": { id: "plastic-glossy", name: "Glossy plastic", color: "#2d5fa8", roughness: 0.15, metalness: 0, clearcoat: 1 },
};

export interface SlotStyle {
    color: string;
    roughness: number;
    metalness: number;
    sheen?: number;
    clearcoat?: number;
    specularIntensity?: number;
}

export const DEFAULT_SLOT_STYLE: Record<string, { color: string; roughness: number; metalness: number }> = {
    body: { color: "#1c1c1c", roughness: 0.7, metalness: 0 },
    accent: { color: "#3a3a3a", roughness: 0.5, metalness: 0 },
    metal: { color: "#9a9ea4", roughness: 0.4, metalness: 1 },
    fabric: { color: "#111111", roughness: 1, metalness: 0 },
    glass: { color: "#202830", roughness: 0.1, metalness: 0 },
    screen: { color: "#05070a", roughness: 0.3, metalness: 0 },
};

export function isMaterialPresetId(v: unknown): v is MaterialPresetId {
    return typeof v === "string" && Object.prototype.hasOwnProperty.call(MATERIAL_PRESETS, v);
}

export interface SlotStyleOptions {
    material?: MaterialPresetId | null;
    color?: string | null;
    variant?: string | null;
}

/**
 * Default slot style → the asset's default colors → variant color → material preset (body only) → color override
 * (body only).
 */
export function resolveSlotStyle(definition: AssetDefinition, slot: MaterialSlot, options: SlotStyleOptions = {}): SlotStyle {
    const base = DEFAULT_SLOT_STYLE[slot] ?? DEFAULT_SLOT_STYLE.body;
    const style: SlotStyle = { ...base };

    const defaultColor = definition.defaultColors?.[slot];
    if (defaultColor) {
        style.color = defaultColor;
    }

    if (options.variant) {
        const variant = definition.variants?.find((v) => v.id === options.variant);
        const color = variant?.slots[slot];
        if (color) {
            style.color = color;
        }
    }

    if (slot === "body" && options.material && isMaterialPresetId(options.material)) {
        const preset = MATERIAL_PRESETS[options.material];
        style.color = preset.color;
        style.roughness = preset.roughness;
        style.metalness = preset.metalness;
        style.sheen = preset.sheen;
        style.clearcoat = preset.clearcoat;
        style.specularIntensity = preset.specularIntensity;
    }

    if (slot === "body" && options.color) {
        style.color = options.color;
    }

    return style;
}
