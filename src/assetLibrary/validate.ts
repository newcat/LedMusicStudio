/**
 * Asset validation (feature 002, research R10). Pure functions; the workbench passes a built template and a
 * parametric `buildAt` factory to enable the geometry checks.
 */
import * as THREE from "three";
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { completeParams } from "./params";
import {
    ALLOWED_LICENSES,
    ASSET_ID_PATTERN,
    type AssetCatalog,
    type AssetCategory,
    type AssetDefinition,
    type BeamDescription,
    type FixtureAssetDefinition,
    type ParamValues,
    type ParametricSource,
    type ValidationIssue,
    type Vec3,
} from "./types";

const CATEGORY_PREFIX: Record<AssetCategory, string> = {
    fixtures: "fixture.",
    stage: "stage.",
    decoration: "decoration.",
    shapes: "shape.",
};

const SIZE_TOLERANCE = 0.15;
const SIZE_TOLERANCE_MIN = 0.02;
const BASE_TOLERANCE = 0.01;
const MIN_EXTENT = 0.05;
const MAX_EXTENT = 20;
const PARAMETRIC_TOLERANCE = 0.02;
const PARAMETRIC_TOLERANCE_MIN = 0.001;
const UNIT_TOLERANCE = 0.01;
const BEAM_REST_TOLERANCE_DEG = 1;
/** Visualization types whose models must declare a `beam` (data-model §9). */
const BEAM_TYPES: VisualizationType[] = [
    VisualizationType.SPOT,
    VisualizationType.MOVING_HEAD,
    VisualizationType.LASER,
    VisualizationType.FLAME,
    VisualizationType.CO2_JET,
    VisualizationType.COLD_SPARK,
    VisualizationType.FOG,
];

export type BuildAt = (params: ParamValues) => THREE.Object3D;

class Issues {
    public readonly list: ValidationIssue[] = [];
    public constructor(private readonly assetId: string) {}
    public error(message: string) {
        this.list.push({ assetId: this.assetId, severity: "error", message });
    }
    public warning(message: string) {
        this.list.push({ assetId: this.assetId, severity: "warning", message });
    }
}

/** Triangle budget per asset kind (contracts/fixture-model-authoring.md, section 3). */
export function triangleBudget(definition: AssetDefinition): number {
    if (definition.source.type === "parametric") {
        return 20000;
    }
    return definition.category === "fixtures" ? 5000 : 3000;
}

/** Bounding box in the frame of `root`, ignoring subtrees flagged with `userData.excludeFromBounds`. */
export function boundsOf(root: THREE.Object3D): THREE.Box3 {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert();
    const box = new THREE.Box3();
    const matrix = new THREE.Matrix4();
    const v = new THREE.Vector3();
    const visit = (obj: THREE.Object3D) => {
        if (obj.userData.excludeFromBounds) {
            return;
        }
        if (obj instanceof THREE.Mesh) {
            const position = (obj.geometry as THREE.BufferGeometry).getAttribute("position");
            if (position) {
                matrix.multiplyMatrices(inverse, obj.matrixWorld);
                for (let i = 0; i < position.count; i++) {
                    box.expandByPoint(v.fromBufferAttribute(position, i).applyMatrix4(matrix));
                }
            }
        }
        obj.children.forEach(visit);
    };
    visit(root);
    return box;
}

export function triangleCount(root: THREE.Object3D): number {
    let count = 0;
    root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            const geometry = obj.geometry as THREE.BufferGeometry;
            const n = geometry.index ? geometry.index.count : (geometry.getAttribute("position")?.count ?? 0);
            count += Math.floor(n / 3);
        }
    });
    return count;
}

function fmt(v: Vec3 | THREE.Vector3): string {
    const a = Array.isArray(v) ? v : [v.x, v.y, v.z];
    return a.map((n) => n.toFixed(3)).join(" × ");
}

function isUnit(v: Vec3): boolean {
    return Math.abs(Math.hypot(v[0], v[1], v[2]) - 1) <= UNIT_TOLERANCE;
}

function checkMetadata(def: AssetDefinition, issues: Issues) {
    if (!ASSET_ID_PATTERN.test(def.id)) {
        issues.error(`Id "${def.id}" does not match ${ASSET_ID_PATTERN}`);
    }
    const prefix = CATEGORY_PREFIX[def.category];
    if (!prefix) {
        issues.error(`Unknown category "${def.category}"`);
    } else if (!def.id.startsWith(prefix)) {
        issues.error(`Id "${def.id}" must start with "${prefix}" for category ${def.category}`);
    }
    if (!def.name?.trim()) {
        issues.error("Name is empty");
    }
    if (!Array.isArray(def.keywords) || def.keywords.filter((k) => k.trim()).length === 0) {
        issues.error("At least one keyword is required");
    }
    const expectedPreview = `asset-library/previews/${def.id}.webp`;
    if (def.preview !== expectedPreview) {
        issues.error(`Preview must be "${expectedPreview}" (is "${def.preview}")`);
    }
    const credits = def.credits;
    if (!credits) {
        issues.error("Credits are missing");
    } else {
        if (!credits.author?.trim()) {
            issues.error("Credits: author is empty");
        }
        if (!credits.source?.trim()) {
            issues.error("Credits: source is empty");
        }
        if (!ALLOWED_LICENSES.includes(credits.license)) {
            issues.error(`Credits: license "${credits.license}" is not allowed`);
        }
        if (credits.madeForProject && credits.license !== "GPL-3.0-or-later") {
            issues.error("Credits: assets made for the project must be GPL-3.0-or-later");
        }
    }
    const hasFixture = (def as Partial<FixtureAssetDefinition>).fixture !== undefined;
    if (def.category === "fixtures" && !hasFixture) {
        issues.error("Fixture assets need a fixture description");
    } else if (def.category !== "fixtures" && hasFixture) {
        issues.error("Only fixture assets may have a fixture description");
    }
}

function checkGeometry(def: AssetDefinition, template: THREE.Object3D, issues: Issues) {
    const box = boundsOf(template);
    if (box.isEmpty()) {
        issues.error("The built template has no geometry");
        return;
    }
    const size = box.getSize(new THREE.Vector3());
    const actual: Vec3 = [size.x, size.y, size.z];
    const axes = ["x", "y", "z"];
    for (let i = 0; i < 3; i++) {
        const expected = def.defaultSize[i];
        const tolerance = Math.max(expected * SIZE_TOLERANCE, SIZE_TOLERANCE_MIN);
        if (Math.abs(actual[i] - expected) > tolerance) {
            issues.error(`Size ${axes[i]} is ${actual[i].toFixed(3)} m, defaultSize says ${expected} m (±${tolerance.toFixed(3)} m)`);
        }
    }
    if (Math.abs(box.min.y) > BASE_TOLERANCE) {
        issues.error(`Lowest point is at y = ${box.min.y.toFixed(3)} m, expected 0 ± ${BASE_TOLERANCE} m`);
    }
    const largest = Math.max(...actual);
    if (largest < MIN_EXTENT || largest > MAX_EXTENT) {
        issues.error(`Size ${fmt(actual)} m is outside 5 cm … 20 m`);
    }
    const triangles = triangleCount(template);
    const budget = triangleBudget(def);
    if (triangles > budget) {
        issues.error(`${triangles} triangles exceed the budget of ${budget}`);
    }
}

function findNode(template: THREE.Object3D, name: string): THREE.Object3D | undefined {
    return name === "" ? template : template.getObjectByName(name);
}

function isDescendant(node: THREE.Object3D, ancestor: THREE.Object3D): boolean {
    let current = node.parent;
    while (current) {
        if (current === ancestor) {
            return true;
        }
        current = current.parent;
    }
    return false;
}

/**
 * Beam direction in the model frame at rest (the template is built at pan = tilt = 0). Without a template only
 * beams on the model root can be resolved; otherwise `null`.
 */
function restBeamDirection(beam: BeamDescription, template: THREE.Object3D | undefined): THREE.Vector3 | null {
    const local = new THREE.Vector3(...beam.direction).normalize();
    if (beam.node === "") {
        return local;
    }
    const node = template ? findNode(template, beam.node) : undefined;
    if (!template || !node) {
        return null;
    }
    template.updateMatrixWorld(true);
    const rootInverse = template.getWorldQuaternion(new THREE.Quaternion()).invert();
    const nodeInRoot = rootInverse.multiply(node.getWorldQuaternion(new THREE.Quaternion()));
    return local.applyQuaternion(nodeInRoot);
}

function checkFixtureContract(def: FixtureAssetDefinition, template: THREE.Object3D | undefined, issues: Issues) {
    const f = def.fixture;
    if (!f) {
        return;
    }
    const nodeExists = (name: string, what: string) => {
        if (template && !findNode(template, name)) {
            issues.error(`${what}: node "${name}" does not exist`);
        }
    };

    for (const role of ["pan", "tilt"] as const) {
        const part = f.movingParts?.[role];
        if (!part) {
            continue;
        }
        nodeExists(part.node, `movingParts.${role}`);
        if (!["x", "y", "z"].includes(part.axis)) {
            issues.error(`movingParts.${role}: axis "${part.axis}" must be x, y or z`);
        }
        if (!(part.min < part.max)) {
            issues.error(`movingParts.${role}: min (${part.min}) must be less than max (${part.max})`);
        }
    }
    const pan = f.movingParts?.pan;
    const tilt = f.movingParts?.tilt;
    if (template && pan && tilt) {
        const panNode = findNode(template, pan.node);
        const tiltNode = findNode(template, tilt.node);
        if (panNode && tiltNode && !isDescendant(tiltNode, panNode)) {
            issues.error(`Tilt node "${tilt.node}" must be a descendant of pan node "${pan.node}"`);
        }
    }

    if (f.beam) {
        nodeExists(f.beam.node, "beam");
        if (!isUnit(f.beam.direction)) {
            issues.error(`beam.direction ${fmt(f.beam.direction)} is not a unit vector`);
        }
        // research R3: at pan = tilt = 0 the beam points up. Only Moving Head and Spot use the beam; a Generic-only
        // model (e.g. the level laser) may point elsewhere.
        const usesBeam = f.visualizationTypes?.some((t) => t === VisualizationType.MOVING_HEAD || t === VisualizationType.SPOT);
        if (usesBeam) {
            const direction = restBeamDirection(f.beam, template);
            if (direction && direction.angleTo(new THREE.Vector3(0, 1, 0)) > THREE.MathUtils.degToRad(BEAM_REST_TOLERANCE_DEG)) {
                issues.error(`Beam points to ${fmt(direction)} at rest, expected +Y (±${BEAM_REST_TOLERANCE_DEG}°)`);
            }
        }
    }
    if (!(f.lensRadius > 0)) {
        issues.error("lensRadius must be > 0");
    }

    if (!f.emitters?.length) {
        issues.error("At least one emitter is required");
    }
    const ids = new Set<string>();
    for (const emitter of f.emitters ?? []) {
        if (ids.has(emitter.id)) {
            issues.error(`Emitter id "${emitter.id}" is not unique`);
        }
        ids.add(emitter.id);
        nodeExists(emitter.node, `emitter "${emitter.id}"`);
        if (!isUnit(emitter.normal)) {
            issues.error(`Emitter "${emitter.id}": normal ${fmt(emitter.normal)} is not a unit vector`);
        }
        if (emitter.shape === "rect" && !isUnit(emitter.up)) {
            issues.error(`Emitter "${emitter.id}": up ${fmt(emitter.up)} is not a unit vector`);
        }
    }

    if (!f.mountingPoints?.length) {
        issues.error("At least one mounting point is required");
    }
    for (const point of f.mountingPoints ?? []) {
        nodeExists(point.node, `mounting point "${point.id}"`);
    }

    const beamTypes = (f.visualizationTypes ?? []).filter((t) => BEAM_TYPES.includes(t));
    if (beamTypes.length > 0 && !f.beam) {
        issues.error(`${beamTypes.join(", ")} needs beam`);
    }

    for (const type of f.visualizationTypes ?? []) {
        if (type === VisualizationType.MOVING_HEAD) {
            if (!pan || !tilt) {
                issues.error("Moving Head needs movingParts.pan and movingParts.tilt");
            }
        } else if (type === VisualizationType.GENERIC) {
            if (!f.emitters?.length) {
                issues.error("Generic Fixture needs at least one emitter");
            }
        } else if (type === VisualizationType.LED_STRIP) {
            const hasLength = def.source.type === "parametric" && def.source.params.some((p) => p.key === "length" && p.type === "number");
            if (!f.ledStrip || !hasLength) {
                issues.error("Led Strip needs ledStrip and a parametric source with a number parameter 'length'");
            }
        }
    }
}

function disposeBuilt(root: THREE.Object3D) {
    root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m: THREE.Material) => m.dispose());
        }
    });
}

/** Parameter sets checked for a parametric source: min/default/max of each number, every choice, all min, all max. */
function parametricCases(source: ParametricSource): Array<{ label: string; raw: ParamValues }> {
    const cases: Array<{ label: string; raw: ParamValues }> = [];
    const allMin: ParamValues = {};
    const allMax: ParamValues = {};
    for (const spec of source.params) {
        if (spec.type === "number") {
            allMin[spec.key] = spec.min;
            allMax[spec.key] = spec.max;
            for (const [label, value] of [
                ["min", spec.min],
                ["default", spec.default],
                ["max", spec.max],
            ] as const) {
                cases.push({ label: `${spec.key} = ${value} (${label})`, raw: { [spec.key]: value } });
            }
        } else {
            for (const option of spec.options) {
                cases.push({ label: `${spec.key} = ${option.value}`, raw: { [spec.key]: option.value } });
            }
        }
    }
    if (Object.keys(allMin).length > 1) {
        cases.push({ label: "all numbers at min", raw: allMin }, { label: "all numbers at max", raw: allMax });
    }
    return cases;
}

function checkParametric(def: AssetDefinition, buildAt: BuildAt, issues: Issues) {
    if (def.source.type !== "parametric") {
        return;
    }
    const source = def.source;
    const budget = triangleBudget(def);
    for (const { label, raw } of parametricCases(source)) {
        const params = completeParams(def, raw);
        let built: THREE.Object3D;
        try {
            built = buildAt(params);
        } catch (err) {
            issues.error(`Build failed at ${label}: ${String(err)}`);
            continue;
        }
        const box = boundsOf(built);
        const size = box.getSize(new THREE.Vector3());
        const expected = source.size(params);
        const actual = [size.x, size.y, size.z];
        for (let i = 0; i < 3; i++) {
            const tolerance = Math.max(expected[i] * PARAMETRIC_TOLERANCE, PARAMETRIC_TOLERANCE_MIN);
            if (box.isEmpty() || Math.abs(actual[i] - expected[i]) > tolerance) {
                issues.error(`At ${label}: built size ${fmt(size)} m does not match size() ${fmt(expected)} m`);
                break;
            }
        }
        if (!box.isEmpty() && Math.abs(box.min.y) > BASE_TOLERANCE) {
            issues.error(`At ${label}: lowest point is at y = ${box.min.y.toFixed(3)} m, expected 0 ± ${BASE_TOLERANCE} m`);
        }
        const triangles = triangleCount(built);
        if (triangles > budget) {
            issues.error(`At ${label}: ${triangles} triangles exceed the budget of ${budget}`);
        }
        disposeBuilt(built);
    }
}

/**
 * Validates one definition. With `template` the geometry and node checks run; with `buildAt` the parametric
 * min/default/max builds are checked against `size(params)`.
 */
export function validateAsset(definition: AssetDefinition, template?: THREE.Object3D, buildAt?: BuildAt): ValidationIssue[] {
    const issues = new Issues(definition.id);
    checkMetadata(definition, issues);
    if (template) {
        checkGeometry(definition, template, issues);
    }
    if (definition.category === "fixtures") {
        checkFixtureContract(definition, template, issues);
    }
    if (buildAt) {
        checkParametric(definition, buildAt, issues);
    }
    return issues.list;
}

/** Metadata checks for every definition plus duplicate ids (dev startup, research R10 point 2). */
export function validateCatalogMetadata(catalog: AssetCatalog): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const seen = new Set<string>();
    for (const def of catalog.all()) {
        if (seen.has(def.id)) {
            issues.push({ assetId: def.id, severity: "error", message: `Duplicate asset id "${def.id}"` });
        }
        seen.add(def.id);
        const collector = new Issues(def.id);
        checkMetadata(def, collector);
        issues.push(...collector.list);
    }
    return issues;
}
