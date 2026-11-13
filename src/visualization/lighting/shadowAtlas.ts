import * as THREE from "three";

import { EDITOR_LAYER, NO_SHADOW_LAYER } from "../layers";

/**
 * Shadow depth atlas of the surface lighting (feature 003, research R11), used only at quality "high"
 * (`quality.shadowLights > 0`). One 2048² depth render target holds a 4×4 grid of 512² tiles; each shadowed spot
 * light renders the scene's depth from its own perspective into its tile. Beams, emitters, particles and strip
 * pixels are on `NO_SHADOW_LAYER` and editor helpers on `EDITOR_LAYER`; the shadow cameras skip both layers.
 *
 * The surface fragment (`shaders/surfaceLighting.frag`) and the beam fragment read the tile through the light's
 * view-projection matrix in `matrices[tile]` (uniform `uShadowTiles`).
 */

/** Length of the `uShadowTiles` uniform array (quality "high" shadows 8 lights). */
export const MAX_SHADOW_LIGHTS = 8;
/** Atlas size in texels and tiles per row; 2048 / 4 = 512 = QualityProfile.shadowTileSize. */
export const SHADOW_ATLAS_SIZE = 2048;
export const SHADOW_ATLAS_GRID = 4;
/** Required fragment texture units (material maps + surface lighting textures + atlas). */
export const MIN_TEXTURE_UNITS_FOR_SHADOWS = 12;

const SHADOW_NEAR = 0.05;
/** The shadow frustum is this much wider than the beam (degrees), so the cone edge stays inside the tile. */
const FOV_MARGIN = 5;
const MAX_FOV = 170;
/** A light whose position moved more than this (meters) or whose direction turned more than ~0.05° re-renders. */
const MOVE_EPSILON = 1e-4;
const DIRECTION_EPSILON = 1 - 4e-7;
const ANGLE_EPSILON = 1e-3;

export interface ShadowLight<K = number> {
    key: K;
    /** World space. */
    position: THREE.Vector3;
    direction: THREE.Vector3;
    /** Full outer beam angle, degrees. */
    angle: number;
    /** meters; the far plane. */
    range: number;
}

interface Tile<K> {
    key: K;
    position: THREE.Vector3;
    direction: THREE.Vector3;
    angle: number;
    range: number;
    sceneVersion: number;
    /** false until the tile was rendered once for this light */
    rendered: boolean;
}

const PLUS_Y = new THREE.Vector3(0, 1, 0);
const PLUS_X = new THREE.Vector3(1, 0, 0);

export class ShadowAtlas<K = number> {
    public readonly target: THREE.WebGLRenderTarget;
    public readonly depthTexture: THREE.DepthTexture;
    /** View-projection matrix per tile (uniform `uShadowTiles`); identity for unused tiles. */
    public readonly matrices: THREE.Matrix4[] = Array.from({ length: MAX_SHADOW_LIGHTS }, () => new THREE.Matrix4());

    private readonly tiles: Array<Tile<K> | null> = new Array<Tile<K> | null>(MAX_SHADOW_LIGHTS).fill(null);
    private readonly camera = new THREE.PerspectiveCamera(30, 1, SHADOW_NEAR, 10);
    private readonly depthMaterial = new THREE.MeshDepthMaterial({ side: THREE.DoubleSide });
    private readonly lookTarget = new THREE.Vector3();
    private readonly tileOf = new Map<K, number>();

    private constructor() {
        this.depthTexture = new THREE.DepthTexture(SHADOW_ATLAS_SIZE, SHADOW_ATLAS_SIZE, THREE.UnsignedIntType);
        this.depthTexture.minFilter = THREE.NearestFilter;
        this.depthTexture.magFilter = THREE.NearestFilter;
        this.target = new THREE.WebGLRenderTarget(SHADOW_ATLAS_SIZE, SHADOW_ATLAS_SIZE, {
            depthBuffer: true,
            stencilBuffer: false,
            depthTexture: this.depthTexture,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            generateMipmaps: false,
        });
        // only the depth attachment is used
        this.depthMaterial.colorWrite = false;
    }

    /** Creates the atlas, or returns null when the depth render target is not usable on this device. */
    public static create<K = number>(renderer: THREE.WebGLRenderer): ShadowAtlas<K> | null {
        let atlas: ShadowAtlas<K> | null = null;
        const previous = renderer.getRenderTarget();
        try {
            atlas = new ShadowAtlas<K>();
            renderer.setRenderTarget(atlas.target);
            const gl = renderer.getContext();
            const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
            renderer.setRenderTarget(previous);
            if (!complete) {
                atlas.dispose();
                return null;
            }
            return atlas;
        } catch (err) {
            console.warn("[shadows] depth atlas could not be created", err);
            renderer.setRenderTarget(previous);
            atlas?.dispose();
            return null;
        }
    }

    /**
     * Assigns tiles to `lights` (at most MAX_SHADOW_LIGHTS; a light keeps its tile while it stays shadowed) and
     * re-renders the tiles whose light moved, turned, changed its angle or range, or when `sceneVersion` changed.
     * `viewCamera` provides the layers; NO_SHADOW_LAYER and EDITOR_LAYER are removed. Returns key → tile index.
     */
    public update(
        renderer: THREE.WebGLRenderer,
        scene: THREE.Scene,
        viewCamera: THREE.Camera,
        lights: ReadonlyArray<ShadowLight<K>>,
        sceneVersion: number,
    ): ReadonlyMap<K, number> {
        const count = Math.min(lights.length, MAX_SHADOW_LIGHTS);

        // 1. free the tiles of lights that are no longer shadowed, keep the others
        const wanted = new Set<K>();
        for (let i = 0; i < count; i++) {
            wanted.add(lights[i].key);
        }
        for (let t = 0; t < MAX_SHADOW_LIGHTS; t++) {
            const tile = this.tiles[t];
            if (tile && !wanted.has(tile.key)) {
                this.tiles[t] = null;
                this.tileOf.delete(tile.key);
                this.matrices[t].identity();
            }
        }
        // 2. new lights get free tiles
        for (let i = 0; i < count; i++) {
            const light = lights[i];
            if (this.tileOf.has(light.key)) {
                continue;
            }
            const free = this.tiles.indexOf(null);
            if (free < 0) {
                break;
            }
            this.tiles[free] = {
                key: light.key,
                position: new THREE.Vector3(),
                direction: new THREE.Vector3(),
                angle: 0,
                range: 0,
                sceneVersion,
                rendered: false,
            };
            this.tileOf.set(light.key, free);
        }

        // 3. re-render changed tiles
        const dirty: Array<{ tile: number; light: ShadowLight<K> }> = [];
        for (let i = 0; i < count; i++) {
            const light = lights[i];
            const t = this.tileOf.get(light.key);
            const tile = t === undefined ? null : this.tiles[t];
            if (t === undefined || !tile) {
                continue;
            }
            const changed =
                !tile.rendered ||
                tile.sceneVersion !== sceneVersion ||
                tile.position.distanceToSquared(light.position) > MOVE_EPSILON * MOVE_EPSILON ||
                tile.direction.dot(light.direction) < DIRECTION_EPSILON ||
                Math.abs(tile.angle - light.angle) > ANGLE_EPSILON ||
                Math.abs(tile.range - light.range) > MOVE_EPSILON;
            if (changed) {
                tile.position.copy(light.position);
                tile.direction.copy(light.direction).normalize();
                tile.angle = light.angle;
                tile.range = light.range;
                tile.sceneVersion = sceneVersion;
                tile.rendered = true;
                dirty.push({ tile: t, light });
            }
        }
        if (dirty.length > 0) {
            this.render(renderer, scene, viewCamera, dirty);
        }
        return this.tileOf;
    }

    public dispose() {
        this.target.dispose();
        this.depthTexture.dispose();
        this.depthMaterial.dispose();
        this.tiles.fill(null);
        this.tileOf.clear();
    }

    private render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, viewCamera: THREE.Camera, dirty: Array<{ tile: number; light: ShadowLight<K> }>) {
        const camera = this.camera;
        camera.layers.mask = viewCamera.layers.mask & ~((1 << NO_SHADOW_LAYER) | (1 << EDITOR_LAYER));

        const previousTarget = renderer.getRenderTarget();
        const previousAutoClear = renderer.autoClear;
        const previousOverride = scene.overrideMaterial;
        const previousBackground = scene.background;
        const previousAutoUpdate = scene.matrixWorldAutoUpdate;
        scene.overrideMaterial = this.depthMaterial;
        scene.background = null;
        // the view updated the world matrices this frame
        scene.matrixWorldAutoUpdate = false;
        renderer.autoClear = false;
        try {
            const size = SHADOW_ATLAS_SIZE / SHADOW_ATLAS_GRID;
            for (const { tile, light } of dirty) {
                this.setupCamera(light);
                this.matrices[tile].multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
                const x = (tile % SHADOW_ATLAS_GRID) * size;
                const y = Math.floor(tile / SHADOW_ATLAS_GRID) * size;
                this.target.viewport.set(x, y, size, size);
                this.target.scissor.set(x, y, size, size);
                this.target.scissorTest = true;
                renderer.setRenderTarget(this.target);
                renderer.state.buffers.depth.setMask(true);
                renderer.clear(false, true, false);
                renderer.render(scene, camera);
            }
        } finally {
            scene.overrideMaterial = previousOverride;
            scene.background = previousBackground;
            scene.matrixWorldAutoUpdate = previousAutoUpdate;
            renderer.autoClear = previousAutoClear;
            renderer.setRenderTarget(previousTarget);
        }
    }

    private setupCamera(light: ShadowLight<K>) {
        const camera = this.camera;
        camera.fov = Math.min(MAX_FOV, Math.max(1, light.angle + FOV_MARGIN));
        camera.aspect = 1;
        camera.near = SHADOW_NEAR;
        camera.far = Math.max(SHADOW_NEAR + 0.1, light.range);
        camera.updateProjectionMatrix();
        camera.position.copy(light.position);
        camera.up.copy(Math.abs(light.direction.y) < 0.99 * light.direction.length() ? PLUS_Y : PLUS_X);
        camera.lookAt(this.lookTarget.copy(light.position).add(light.direction));
        camera.updateMatrixWorld(true);
    }
}
