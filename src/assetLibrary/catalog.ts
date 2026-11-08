/**
 * The built-in asset catalog (feature 002, contracts/asset-catalog.ts → AssetCatalog).
 */
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { FIXTURE_ASSETS } from "./catalog/fixtures";
import { STAGE_ASSETS } from "./catalog/stage";
import { DECORATION_ASSETS } from "./catalog/decoration";
import { SHAPE_ASSETS } from "./catalog/shapes";
import type { AssetCatalog, AssetDefinition, FixtureAssetDefinition } from "./types";

export const GENERIC_MODEL_ID = "fixture.generic";

// TODO(002): use VisualizationType.GENERIC once T014 adds it
const GENERIC_TYPE = "Generic Fixture";

const DEFAULT_MODEL_BY_TYPE: Record<string, string> = {
    [VisualizationType.MOVING_HEAD]: "fixture.moving-head-spot",
    [VisualizationType.SPOT]: "fixture.par-can",
    [GENERIC_TYPE]: GENERIC_MODEL_ID,
    [VisualizationType.LED_STRIP]: "fixture.led-profile",
};

export class Catalog implements AssetCatalog {
    private readonly definitions: readonly AssetDefinition[];
    private readonly byId = new Map<string, AssetDefinition>();
    /** Runtime blocklist of fixture models that failed validation (research R10, point 3). */
    private readonly invalid = new Set<string>();

    public constructor(definitions: readonly AssetDefinition[]) {
        this.definitions = definitions;
        for (const def of definitions) {
            if (this.byId.has(def.id) && import.meta.env.DEV) {
                throw new Error(`[asset-library] duplicate asset id "${def.id}"`);
            }
            if (!this.byId.has(def.id)) {
                this.byId.set(def.id, def);
            }
        }
    }

    public all(): readonly AssetDefinition[] {
        return this.definitions;
    }

    public get(id: string): AssetDefinition | undefined {
        return this.byId.get(id);
    }

    public search(query: string): AssetDefinition[] {
        const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
        if (words.length === 0) {
            return [...this.definitions];
        }
        return this.definitions.filter((def) => {
            const haystack = `${def.name} ${def.category} ${def.keywords.join(" ")}`.toLowerCase();
            return words.every((w) => haystack.includes(w));
        });
    }

    public modelsFor(type: VisualizationType): FixtureAssetDefinition[] {
        return this.definitions.filter(
            (def): def is FixtureAssetDefinition =>
                def.category === "fixtures" && def.fixture.visualizationTypes.includes(type) && !this.invalid.has(def.id),
        );
    }

    public defaultModelFor(type: VisualizationType): FixtureAssetDefinition {
        const preferred = this.fixtureModel(DEFAULT_MODEL_BY_TYPE[type]);
        if (preferred && !this.invalid.has(preferred.id)) {
            return preferred;
        }
        const generic = this.fixtureModel(GENERIC_MODEL_ID);
        if (!generic) {
            throw new Error(`[asset-library] fallback model "${GENERIC_MODEL_ID}" is not registered`);
        }
        return generic;
    }

    /** Excludes a fixture model from `modelsFor` and `defaultModelFor` after it failed its runtime check. */
    public markInvalid(id: string) {
        this.invalid.add(id);
    }

    public isInvalid(id: string): boolean {
        return this.invalid.has(id);
    }

    private fixtureModel(id: string | undefined): FixtureAssetDefinition | undefined {
        const def = id ? this.byId.get(id) : undefined;
        return def?.category === "fixtures" ? def : undefined;
    }
}

export const assetCatalog = new Catalog([...FIXTURE_ASSETS, ...STAGE_ASSETS, ...DECORATION_ASSETS, ...SHAPE_ASSETS]);
