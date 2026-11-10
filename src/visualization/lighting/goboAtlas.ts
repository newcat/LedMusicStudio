import * as THREE from "three";

/**
 * Gobo images of one view packed into a single texture (feature 003, research R9): a 2048² canvas split into an
 * 8×8 grid of 256² tiles. White means light passes, black blocks it. Every tile is black outside an inscribed
 * circle, so mipmapping never bleeds neighbouring tiles into each other.
 *
 * Tile layout for shaders: tile `t` covers `uv ∈ [col/8, (col+1)/8] × [row/8, (row+1)/8]` with
 * `col = t % 8`, `row = floor(t / 8)` (the texture is not flipped, so canvas y runs along +v).
 */

/** Tiles per row/column; the shader needs the same value. */
export const GOBO_ATLAS_GRID = 8;
export const GOBO_TILE_SIZE = 256;
export const GOBO_ATLAS_SIZE = GOBO_ATLAS_GRID * GOBO_TILE_SIZE;
export const GENERIC_GOBO_COUNT = 12;

const TILE_COUNT = GOBO_ATLAS_GRID * GOBO_ATLAS_GRID;
/** Radius of the light-passing circle inside a tile, in pixels (leaves a black margin for mipmaps). */
const RADIUS = GOBO_TILE_SIZE * 0.46;
const GENERIC_PREFIX = "generic:";

export interface GoboAtlas {
    readonly texture: THREE.Texture;
    /** SVG markup or "generic:<n>"; resolves to a tile index; images that fail to load use a generic pattern. */
    acquire(image: string): number;
    release(tile: number): void;
}

interface TileEntry {
    key: string;
    tile: number;
    refs: number;
}

/** FNV-1a, 32 bit. */
function hashString(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** Small deterministic PRNG (mulberry32) so the random-looking patterns look the same in every view. */
function random(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function polygon(ctx: CanvasRenderingContext2D, points: Array<[number, number]>) {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

/** Draws generic pattern `n` (0..11) centered at the origin, white on the current (black) background. */
function drawGenericPattern(ctx: CanvasRenderingContext2D, n: number) {
    const R = RADIUS;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#fff";
    switch (n) {
        case 0: {
            // dots ring
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                disc(ctx, Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, R * 0.16);
            }
            break;
        }
        case 1: {
            // star
            const points: Array<[number, number]> = [];
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
                const r = i % 2 === 0 ? R * 0.92 : R * 0.38;
                points.push([Math.cos(a) * r, Math.sin(a) * r]);
            }
            polygon(ctx, points);
            break;
        }
        case 2: {
            // bars
            const w = (R * 2) / 9;
            for (let i = 0; i < 5; i++) {
                ctx.fillRect(-R + w * (i * 2), -R, w, R * 2);
            }
            break;
        }
        case 3: {
            // ring
            ctx.beginPath();
            ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2);
            ctx.arc(0, 0, R * 0.55, 0, Math.PI * 2, true);
            ctx.fill();
            break;
        }
        case 4: {
            // triangles pointing outward
            for (let i = 0; i < 3; i++) {
                const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
                const da = 0.45;
                polygon(ctx, [
                    [Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95],
                    [Math.cos(a + da) * R * 0.3, Math.sin(a + da) * R * 0.3],
                    [Math.cos(a - da) * R * 0.3, Math.sin(a - da) * R * 0.3],
                ]);
            }
            break;
        }
        case 5: {
            // cross
            const w = R * 0.32;
            ctx.fillRect(-w / 2, -R, w, R * 2);
            ctx.fillRect(-R, -w / 2, R * 2, w);
            break;
        }
        case 6: {
            // spiral arms
            ctx.lineCap = "round";
            ctx.lineWidth = R * 0.16;
            for (let arm = 0; arm < 4; arm++) {
                ctx.beginPath();
                for (let s = 0; s <= 32; s++) {
                    const t = s / 32;
                    const a = (arm / 4) * Math.PI * 2 + t * Math.PI * 1.2;
                    const r = R * (0.12 + t * 0.85);
                    if (s === 0) {
                        ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
                    } else {
                        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                    }
                }
                ctx.stroke();
            }
            break;
        }
        case 7: {
            // grid of square holes
            const cells = 6;
            const cell = (R * 2) / cells;
            for (let y = 0; y < cells; y++) {
                for (let x = 0; x < cells; x++) {
                    ctx.fillRect(-R + x * cell + cell * 0.15, -R + y * cell + cell * 0.15, cell * 0.7, cell * 0.7);
                }
            }
            break;
        }
        case 8: {
            // flower
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.ellipse(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, R * 0.42, R * 0.18, a, 0, Math.PI * 2);
                ctx.fill();
            }
            disc(ctx, 0, 0, R * 0.18);
            break;
        }
        case 9: {
            // half moon
            disc(ctx, 0, 0, R * 0.8);
            ctx.fillStyle = "#000";
            disc(ctx, R * 0.38, -R * 0.12, R * 0.68);
            ctx.fillStyle = "#fff";
            break;
        }
        case 10: {
            // scattered dots
            const rnd = random(10);
            for (let i = 0; i < 28; i++) {
                const a = rnd() * Math.PI * 2;
                const r = Math.sqrt(rnd()) * R * 0.9;
                disc(ctx, Math.cos(a) * r, Math.sin(a) * r, R * (0.04 + rnd() * 0.08));
            }
            break;
        }
        default: {
            // breakup noise: overlapping blobs of very different sizes
            const rnd = random(11);
            for (let i = 0; i < 70; i++) {
                const a = rnd() * Math.PI * 2;
                const r = Math.sqrt(rnd()) * R;
                const size = R * (0.03 + Math.pow(rnd(), 2) * 0.16);
                ctx.beginPath();
                ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, size, size * (0.5 + rnd() * 0.5), rnd() * Math.PI, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        }
    }
}

export class CanvasGoboAtlas implements GoboAtlas {
    public readonly texture: THREE.CanvasTexture;

    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly entries = new Map<string, TileEntry>();
    private readonly tiles: Array<TileEntry | null> = new Array<TileEntry | null>(TILE_COUNT).fill(null);
    private scratch: CanvasRenderingContext2D | null = null;
    private disposed = false;

    public constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = GOBO_ATLAS_SIZE;
        this.canvas.height = GOBO_ATLAS_SIZE;
        const ctx = this.canvas.getContext("2d", { willReadFrequently: false });
        if (!ctx) {
            throw new Error("GoboAtlas: 2D canvas context unavailable");
        }
        this.ctx = ctx;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, GOBO_ATLAS_SIZE, GOBO_ATLAS_SIZE);

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.flipY = false;
        this.texture.colorSpace = THREE.NoColorSpace;
        this.texture.wrapS = THREE.ClampToEdgeWrapping;
        this.texture.wrapT = THREE.ClampToEdgeWrapping;
        this.texture.minFilter = THREE.LinearMipmapLinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.generateMipmaps = true;
        this.texture.needsUpdate = true;
    }

    /**
     * Returns the tile for `image` (SVG markup or "generic:<n>"), −1 when the atlas is full. SVG tiles show generic
     * pattern `fallbackPattern` (default: derived from the hash) while loading and when the image fails.
     */
    public acquire(image: string, fallbackPattern?: number): number {
        if (this.disposed) {
            return -1;
        }
        const generic = image.startsWith(GENERIC_PREFIX);
        const key = generic ? image : `svg:${hashString(image).toString(16)}:${image.length}`;
        const existing = this.entries.get(key);
        if (existing) {
            existing.refs++;
            return existing.tile;
        }
        const tile = this.tiles.indexOf(null);
        if (tile < 0) {
            console.warn(`GoboAtlas: all ${TILE_COUNT} tiles in use; gobo renders open`);
            return -1;
        }
        const entry: TileEntry = { key, tile, refs: 1 };
        this.entries.set(key, entry);
        this.tiles[tile] = entry;

        if (generic) {
            this.drawGeneric(tile, Number.parseInt(image.slice(GENERIC_PREFIX.length), 10));
        } else {
            this.drawGeneric(tile, fallbackPattern ?? hashString(image));
            this.loadSvg(entry, image);
        }
        return tile;
    }

    /** Frees the tile once its reference count reaches 0. */
    public release(tile: number) {
        const entry = this.tiles[tile];
        if (!entry || --entry.refs > 0) {
            return;
        }
        this.entries.delete(entry.key);
        this.tiles[tile] = null;
        this.clearTile(tile);
        this.texture.needsUpdate = true;
    }

    public dispose() {
        this.disposed = true;
        this.entries.clear();
        this.tiles.fill(null);
        this.texture.dispose();
        this.scratch = null;
    }

    private tileOrigin(tile: number): [number, number] {
        return [(tile % GOBO_ATLAS_GRID) * GOBO_TILE_SIZE, Math.floor(tile / GOBO_ATLAS_GRID) * GOBO_TILE_SIZE];
    }

    private clearTile(tile: number) {
        const [x, y] = this.tileOrigin(tile);
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(x, y, GOBO_TILE_SIZE, GOBO_TILE_SIZE);
    }

    private drawGeneric(tile: number, pattern: number) {
        const n = Number.isFinite(pattern) ? ((Math.trunc(pattern) % GENERIC_GOBO_COUNT) + GENERIC_GOBO_COUNT) % GENERIC_GOBO_COUNT : 0;
        const [x, y] = this.tileOrigin(tile);
        const ctx = this.ctx;
        this.clearTile(tile);
        ctx.save();
        ctx.translate(x + GOBO_TILE_SIZE / 2, y + GOBO_TILE_SIZE / 2);
        ctx.beginPath();
        ctx.arc(0, 0, RADIUS, 0, Math.PI * 2);
        ctx.clip();
        drawGenericPattern(ctx, n);
        ctx.restore();
        this.texture.needsUpdate = true;
    }

    private loadSvg(entry: TileEntry, svg: string) {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
            // released (or the atlas disposed) while loading
            if (this.disposed || this.tiles[entry.tile] !== entry) {
                return;
            }
            try {
                this.drawSvg(entry.tile, img);
            } catch (error) {
                console.warn("GoboAtlas: could not rasterize gobo image; using a generic pattern", error);
            }
        };
        img.onerror = () => {
            if (!this.disposed && this.tiles[entry.tile] === entry) {
                console.warn("GoboAtlas: gobo image failed to load; using a generic pattern");
            }
        };
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }

    /**
     * Rasterizes the image on a scratch canvas (so a tainted canvas can never block the atlas upload), converts it
     * to luminance × alpha and copies it into the tile, masked to the inscribed circle.
     */
    private drawSvg(tile: number, img: HTMLImageElement) {
        const size = GOBO_TILE_SIZE;
        if (!this.scratch) {
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            this.scratch = canvas.getContext("2d", { willReadFrequently: true });
            if (!this.scratch) {
                throw new Error("2D canvas context unavailable");
            }
        }
        const s = this.scratch;
        s.clearRect(0, 0, size, size);
        // fit, keeping the aspect ratio; SVGs without intrinsic size are drawn square
        const w = img.naturalWidth || size;
        const h = img.naturalHeight || size;
        const scale = Math.min(size / w, size / h);
        const dw = w * scale;
        const dh = h * scale;
        s.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);

        const data = s.getImageData(0, 0, size, size);
        const px = data.data;
        const c = size / 2;
        const r2 = RADIUS * RADIUS;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                const dx = x + 0.5 - c;
                const dy = y + 0.5 - c;
                const inside = dx * dx + dy * dy <= r2;
                const l = inside ? (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) * (px[i + 3] / 255) : 0;
                px[i] = l;
                px[i + 1] = l;
                px[i + 2] = l;
                px[i + 3] = 255;
            }
        }
        const [x, y] = this.tileOrigin(tile);
        this.ctx.putImageData(data, x, y);
        this.texture.needsUpdate = true;
    }
}
