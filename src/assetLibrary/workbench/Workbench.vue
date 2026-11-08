<script setup lang="ts">
/**
 * Asset workbench (feature 002, research R10 point 1, quickstart "Asset gate"). Dev server only.
 * Validates every catalog asset, shows it with its contract overlay and renders the preview images.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { zipSync } from "fflate";
import Button from "primevue/button";
import SelectButton from "primevue/selectbutton";
import ToggleSwitch from "primevue/toggleswitch";
import { LedStripLighting } from "@/visualization/ledLitMaterial";
import {
    AssetCache,
    assetCatalog,
    boundsOf,
    completeParams,
    createBuilderKit,
    FixtureBody,
    instantiate,
    validateAsset,
    type AssetDefinition,
    type ConnectionPoint,
    type MountingArea,
    type ParamValues,
    type ValidationIssue,
    type Vec3,
} from "@/assetLibrary";

type ParamMode = "min" | "default" | "max";
type Status = "pending" | "ok" | "warning" | "error";

interface Row {
    id: string;
    name: string;
    category: string;
    status: Status;
    issues: ValidationIssue[];
}

const WORKBENCH_USER = "workbench";
const PREVIEW_SIZE = 256;
const PREVIEW_FOV = 30;
const PREVIEW_DIRECTION = new THREE.Vector3(1, 0.8, 1.4).normalize();
const SWEEP_PERIOD_MS = 5000;

const definitions = assetCatalog.all();
const rows = ref<Row[]>(
    definitions.map((d) => ({ id: d.id, name: d.name, category: d.category, status: "pending" as Status, issues: [] as ValidationIssue[] })),
);
const selectedId = ref<string | null>(definitions[0]?.id ?? null);
const paramMode = ref<ParamMode>("default");
const sweep = ref(false);
const rendering = ref(false);
const canvasHost = ref<HTMLDivElement | null>(null);

const selectedDef = computed(() => (selectedId.value ? assetCatalog.get(selectedId.value) : undefined));
const selectedRow = computed(() => rows.value.find((r) => r.id === selectedId.value));
const errorCount = computed(() => rows.value.reduce((n, r) => n + r.issues.filter((i) => i.severity === "error").length, 0));
const paramModes: ParamMode[] = ["min", "default", "max"];

// ---------------------------------------------------------------------------------------------------------------
// Three.js state (kept outside Vue reactivity)
// ---------------------------------------------------------------------------------------------------------------

const lighting = new LedStripLighting();
const cache = new AssetCache(lighting);
const shapeTemplates = new Map<string, THREE.Object3D>();
let renderer: THREE.WebGLRenderer | null = null;
let controls: OrbitControls | null = null;
let resizeObserver: ResizeObserver | null = null;
let frame = 0;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e1f22);
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
camera.position.set(1.5, 1.2, 2);
const display = new THREE.Group();
scene.add(display);
const overlayDisposables: Array<{ dispose(): void }> = [];

/** Body of the selected fixture model, driven by the sweep. */
let fixtureBody: FixtureBody | null = null;
let showToken = 0;

function addLights(target: THREE.Scene) {
    target.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
    const dir = new THREE.DirectionalLight(0xffffff, 2.5);
    dir.position.set(3, 5, 4);
    target.add(dir);
}
addLights(scene);
scene.add(new THREE.GridHelper(20, 20, 0x666666, 0x333333));

function paramsFor(def: AssetDefinition, mode: ParamMode): ParamValues {
    if (def.source.type !== "parametric") {
        return {};
    }
    const raw: ParamValues = {};
    for (const spec of def.source.params) {
        if (spec.type === "number" && mode !== "default") {
            raw[spec.key] = mode === "min" ? spec.min : spec.max;
        }
    }
    return completeParams(def, raw);
}

function shapeTemplate(def: AssetDefinition): THREE.Object3D | null {
    if (def.source.type !== "shape") {
        return null;
    }
    let template = shapeTemplates.get(def.id);
    if (!template) {
        const [w, h, d] = def.defaultSize;
        let geometry: THREE.BufferGeometry;
        switch (def.source.shape) {
            case "box":
                geometry = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
                break;
            case "cylinder":
                geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32).scale(w, h, d).translate(0, h / 2, 0);
                break;
            case "plane":
                geometry = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
                break;
            case "sphere":
                geometry = new THREE.SphereGeometry(0.5, 32, 16).scale(w, h, d).translate(0, h / 2, 0);
                break;
        }
        template = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x9a9ea4, roughness: 0.8, side: THREE.DoubleSide }));
        shapeTemplates.set(def.id, template);
    }
    return template;
}

async function templateFor(def: AssetDefinition, mode: ParamMode): Promise<THREE.Object3D | null> {
    if (def.source.type === "shape") {
        return shapeTemplate(def);
    }
    return cache.acquire({ assetId: def.id, params: paramsFor(def, mode) }, WORKBENCH_USER);
}

// ---------------------------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------------------------

async function previewExists(def: AssetDefinition): Promise<boolean> {
    try {
        const response = await fetch(def.preview, { method: "HEAD" });
        // the dev server answers unknown paths with index.html, so check the content type too
        return response.ok && (response.headers.get("content-type") ?? "").startsWith("image/");
    } catch {
        return false;
    }
}

async function validateRow(row: Row) {
    const def = assetCatalog.get(row.id);
    if (!def) {
        return;
    }
    const template = await templateFor(def, "default");
    const source = def.source;
    const buildAt = source.type === "parametric" ? (p: ParamValues) => source.build(p, createBuilderKit()) : undefined;
    const issues = validateAsset(def, template ?? undefined, buildAt);
    if (!template) {
        issues.unshift({ assetId: def.id, severity: "error", message: "The template could not be built or loaded" });
    }
    if (!(await previewExists(def))) {
        issues.push({ assetId: def.id, severity: "error", message: `Preview file ${def.preview} is missing` });
    }
    row.issues = issues;
    row.status = issues.some((i) => i.severity === "error") ? "error" : issues.length > 0 ? "warning" : "ok";
}

async function validateAll() {
    for (const row of rows.value) {
        row.status = "pending";
    }
    for (const row of rows.value) {
        await validateRow(row);
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Contract overlay
// ---------------------------------------------------------------------------------------------------------------

function overlayObject<T extends THREE.Object3D>(obj: T): T {
    obj.userData.excludeFromBounds = true;
    obj.raycast = () => undefined;
    obj.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
            overlayDisposables.push(child.geometry, child.material as THREE.Material);
        }
    });
    return obj;
}

function nodeOf(root: THREE.Object3D, name: string): THREE.Object3D {
    return (name === "" ? root : root.getObjectByName(name)) ?? root;
}

function vec(v: Vec3): THREE.Vector3 {
    return new THREE.Vector3(v[0], v[1], v[2]);
}

/** Orientation whose +Z is `normal` and, if given, whose +Y follows `up`. */
function orientation(normal: Vec3, up?: Vec3): THREE.Quaternion {
    const z = vec(normal).normalize();
    if (!up) {
        return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), z);
    }
    const y = vec(up).normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    y.crossVectors(z, x);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

function outline(points: THREE.Vector3[], color: number): THREE.LineLoop {
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, depthTest: false }));
}

function circlePoints(radius: number): THREE.Vector3[] {
    return Array.from({ length: 32 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    });
}

function rectPoints(w: number, h: number): THREE.Vector3[] {
    return [new THREE.Vector3(-w / 2, -h / 2, 0), new THREE.Vector3(w / 2, -h / 2, 0), new THREE.Vector3(w / 2, h / 2, 0), new THREE.Vector3(-w / 2, h / 2, 0)];
}

function addArrow(parent: THREE.Object3D, origin: Vec3, direction: Vec3, length: number, color: number) {
    const arrow = new THREE.ArrowHelper(vec(direction).normalize(), vec(origin), length, color, length * 0.2, length * 0.1);
    overlayDisposables.push(arrow);
    parent.add(overlayObject(arrow));
}

function buildOverlay(def: AssetDefinition, instance: THREE.Object3D, params: ParamValues) {
    if (def.category === "fixtures") {
        const f = def.fixture;
        for (const role of ["pan", "tilt"] as const) {
            const part = f.movingParts?.[role];
            if (!part) {
                continue;
            }
            const node = nodeOf(instance, part.node);
            const gizmo = new THREE.AxesHelper(0.15);
            overlayDisposables.push(gizmo);
            node.add(overlayObject(gizmo));
        }
        if (f.beam) {
            addArrow(nodeOf(instance, f.beam.node), f.beam.position, f.beam.direction, 0.5, 0xffd400);
        }
        for (const emitter of f.emitters) {
            const loop = outline(emitter.shape === "circle" ? circlePoints(emitter.radius) : rectPoints(emitter.size[0], emitter.size[1]), 0x00e5ff);
            loop.position.copy(vec(emitter.position));
            loop.quaternion.copy(orientation(emitter.normal, emitter.shape === "rect" ? emitter.up : undefined));
            nodeOf(instance, emitter.node).add(overlayObject(loop));
        }
        for (const point of f.mountingPoints) {
            const cone = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 12), new THREE.MeshBasicMaterial({ color: 0xff3df5, depthTest: false }));
            cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec(point.direction).normalize());
            cone.position.copy(vec(point.position)).addScaledVector(vec(point.direction).normalize(), 0.03);
            nodeOf(instance, point.node).add(overlayObject(cone));
        }
        return;
    }
    let areas: MountingArea[] = def.mounting?.areas ?? [];
    let connections: ConnectionPoint[] = def.mounting?.connections ?? [];
    if (def.source.type === "parametric") {
        areas = def.source.mountingAreas?.(params) ?? areas;
        connections = def.source.connections?.(params) ?? connections;
    }
    for (const area of areas) {
        if (area.type === "line") {
            const line = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([vec(area.start), vec(area.end)]),
                new THREE.LineBasicMaterial({ color: 0x00e5ff, depthTest: false }),
            );
            instance.add(overlayObject(line));
        } else {
            const rect = outline(rectPoints(area.size[0], area.size[1]), 0x00e5ff);
            rect.position.copy(vec(area.center));
            rect.quaternion.copy(orientation(area.normal));
            instance.add(overlayObject(rect));
        }
    }
    for (const c of connections) {
        addArrow(instance, c.position, c.direction, 0.25, 0xff8a00);
    }
}

function clearDisplay() {
    for (const child of [...display.children]) {
        child.removeFromParent();
    }
    for (const d of overlayDisposables.splice(0)) {
        d.dispose();
    }
    fixtureBody?.dispose();
    fixtureBody = null;
}

async function showSelected(frameCamera: boolean) {
    const token = ++showToken;
    const def = selectedDef.value;
    clearDisplay();
    if (!def) {
        return;
    }
    const template = await templateFor(def, paramMode.value);
    if (token !== showToken || !template) {
        return;
    }
    let instance: THREE.Object3D;
    if (def.category === "fixtures") {
        fixtureBody = new FixtureBody(def, template);
        fixtureBody.setEmitterColor("all", 1, 1, 1);
        instance = fixtureBody.model;
        display.add(fixtureBody);
    } else {
        instance = instantiate(template);
        display.add(instance);
    }
    buildOverlay(def, instance, paramsFor(def, paramMode.value));
    if (frameCamera && controls) {
        const sphere = boundsOf(instance).getBoundingSphere(new THREE.Sphere());
        const radius = Math.max(sphere.radius, 0.1);
        controls.target.copy(sphere.center);
        camera.position.copy(sphere.center).addScaledVector(PREVIEW_DIRECTION, radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)));
        controls.update();
    }
}

watch(selectedId, () => void showSelected(true));
watch(paramMode, () => void showSelected(false));

function applySweep(time: number) {
    const body = fixtureBody;
    if (!body) {
        return;
    }
    if (!sweep.value) {
        body.setPanTilt(0, 0);
        return;
    }
    const phase = (1 - Math.cos((time / SWEEP_PERIOD_MS) * Math.PI * 2)) / 2;
    const parts = body.definition.fixture.movingParts;
    const angle = (part: { min: number; max: number } | undefined) => (part ? part.min + (part.max - part.min) * phase : 0);
    body.setPanTilt(angle(parts?.pan), angle(parts?.tilt));
}

function animate(time: number) {
    frame = requestAnimationFrame(animate);
    applySweep(time);
    controls?.update();
    lighting.update();
    renderer?.render(scene, camera);
}

function resize() {
    const host = canvasHost.value;
    if (!host || !renderer) {
        return;
    }
    const { clientWidth: w, clientHeight: h } = host;
    renderer.setSize(w, h);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------------------------------------------
// Preview rendering
// ---------------------------------------------------------------------------------------------------------------

function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/webp", 0.9);
    });
}

async function renderPreviews() {
    rendering.value = true;
    const previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    try {
        previewRenderer.setPixelRatio(1);
        previewRenderer.setSize(PREVIEW_SIZE, PREVIEW_SIZE);
        previewRenderer.setClearColor(0x000000, 0);
        const previewScene = new THREE.Scene();
        addLights(previewScene);
        const previewCamera = new THREE.PerspectiveCamera(PREVIEW_FOV, 1, 0.01, 200);
        const files: Record<string, Uint8Array> = {};

        for (const def of definitions) {
            const template = await templateFor(def, "default");
            if (!template) {
                console.error(`[asset-workbench] no template for ${def.id}, preview skipped`);
                continue;
            }
            const instance = instantiate(template);
            previewScene.add(instance);
            const sphere = boundsOf(instance).getBoundingSphere(new THREE.Sphere());
            const radius = Math.max(sphere.radius, 0.05);
            const distance = radius / Math.sin(THREE.MathUtils.degToRad(PREVIEW_FOV / 2));
            previewCamera.position.copy(sphere.center).addScaledVector(PREVIEW_DIRECTION, distance);
            previewCamera.near = Math.max(0.001, distance - radius * 2);
            previewCamera.far = distance + radius * 2;
            previewCamera.lookAt(sphere.center);
            previewCamera.updateProjectionMatrix();
            lighting.update();
            previewRenderer.render(previewScene, previewCamera);
            const blob = await canvasToWebp(previewRenderer.domElement);
            files[`${def.id}.webp`] = new Uint8Array(await blob.arrayBuffer());
            instance.removeFromParent();
        }

        const zip = zipSync(files, { level: 0 });
        const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "asset-previews.zip";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
        previewRenderer.dispose();
        rendering.value = false;
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------------------------------------------

onMounted(() => {
    const host = canvasHost.value!;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    host.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.3, 0);
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();
    frame = requestAnimationFrame(animate);
    void showSelected(true);
    void validateAll();
});

onBeforeUnmount(() => {
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    clearDisplay();
    controls?.dispose();
    renderer?.dispose();
    cache.dispose();
    lighting.dispose();
});

const STATUS_CLASS: Record<Status, string> = {
    pending: "bg-gray-500",
    ok: "bg-green-500",
    warning: "bg-yellow-400",
    error: "bg-red-500",
};
</script>

<template>
    <div class="flex h-screen text-sm">
        <aside class="w-72 shrink-0 overflow-auto border-r border-gray-700 p-2">
            <div class="mb-2 font-semibold">{{ rows.length }} assets, {{ errorCount }} errors</div>
            <div class="mb-2 flex gap-2">
                <Button label="Revalidate" size="small" severity="secondary" @click="validateAll" />
                <Button label="Render previews" size="small" :loading="rendering" @click="renderPreviews" />
            </div>
            <ul>
                <li
                    v-for="row in rows"
                    :key="row.id"
                    class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-700"
                    :class="{ 'bg-gray-700': row.id === selectedId }"
                    @click="selectedId = row.id"
                >
                    <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :class="STATUS_CLASS[row.status]"></span>
                    <span class="truncate">{{ row.name }}</span>
                    <span class="ml-auto truncate text-xs text-gray-400">{{ row.id }}</span>
                </li>
            </ul>
            <div v-if="rows.length === 0" class="text-gray-400">The catalog is empty.</div>
        </aside>
        <main class="flex min-w-0 flex-1 flex-col">
            <div class="flex items-center gap-4 border-b border-gray-700 p-2">
                <span class="font-semibold">{{ selectedDef?.name ?? "No asset selected" }}</span>
                <SelectButton
                    v-if="selectedDef?.source.type === 'parametric'"
                    v-model="paramMode"
                    :options="paramModes"
                    :allow-empty="false"
                    size="small"
                />
                <label v-if="selectedDef?.category === 'fixtures'" class="flex items-center gap-2">
                    <ToggleSwitch v-model="sweep" />
                    Sweep
                </label>
            </div>
            <div ref="canvasHost" class="relative min-h-0 flex-1"></div>
            <div class="h-40 shrink-0 overflow-auto border-t border-gray-700 p-2">
                <div v-if="!selectedRow">-</div>
                <div v-else-if="selectedRow.status === 'pending'" class="text-gray-400">Validating…</div>
                <div v-else-if="selectedRow.issues.length === 0" class="text-green-400">No issues.</div>
                <ul v-else>
                    <li
                        v-for="(issue, i) in selectedRow.issues"
                        :key="i"
                        :class="issue.severity === 'error' ? 'text-red-400' : 'text-yellow-300'"
                    >
                        {{ issue.severity }}: {{ issue.message }}
                    </li>
                </ul>
            </div>
        </main>
    </div>
</template>
