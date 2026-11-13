import {
    AdditiveBlending,
    Color,
    HalfFloatType,
    MeshBasicMaterial,
    ShaderMaterial,
    type TextureDataType,
    UniformsUtils,
    Vector2,
    Vector3,
    WebGLRenderer,
    WebGLRenderTarget,
} from "three";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader";
import { LuminosityHighPassShader } from "three/examples/jsm/shaders/LuminosityHighPassShader";

/** Number of mips the kernel and factor tables support. */
const MAX_MIPS = 5;
const KERNEL_SIZES = [3, 5, 7, 9, 11];
const BLOOM_FACTORS = [1.0, 0.8, 0.6, 0.4, 0.2];

function clampMips(mips: number): number {
    return Math.min(MAX_MIPS, Math.max(1, Math.round(mips)));
}

/**
 * UnrealBloomPass is inspired by the bloom pass of Unreal Engine. It creates a
 * mip map chain of bloom textures and blurs them with different radii. Because
 * of the weighted combination of mips, and because larger blurs are done on
 * higher mips, this effect provides good quality and performance.
 *
 * Feature 003 (FR-051, research R12): the chain starts at half the drawing-buffer size and follows `setSize`; the
 * number of mips follows `quality.bloomMips` (`setMips`).
 *
 * Reference:
 * - https://docs.unrealengine.com/latest/INT/Engine/Rendering/PostProcessEffects/Bloom/
 */
class UnrealBloomPass extends Pass {
    public static BlurDirectionX = new Vector2(1.0, 0.0);
    public static BlurDirectionY = new Vector2(0.0, 1.0);
    public static readonly MAX_MIPS = MAX_MIPS;

    public strength: number;
    public radius: number;
    public threshold: number;
    /** Size of the input (drawing buffer) in pixels. */
    public resolution: Vector2;

    private clearColor = new Color(0, 0, 0);
    private _oldClearColor = new Color();
    private oldClearAlpha = 1;
    private nMips: number;
    private readonly targetType: TextureDataType;
    private bloomTintColors = Array.from({ length: MAX_MIPS }, () => new Vector3(1, 1, 1));

    private renderTargetsHorizontal: WebGLRenderTarget[] = [];
    private renderTargetsVertical: WebGLRenderTarget[] = [];
    private renderTargetBright: WebGLRenderTarget;
    private highPassUniforms: (typeof LuminosityHighPassShader)["uniforms"];
    private materialHighPassFilter: ShaderMaterial;
    private separableBlurMaterials: ShaderMaterial[] = [];
    private compositeMaterial: ShaderMaterial | null = null;
    private copyUniforms: (typeof CopyShader)["uniforms"];
    private blendMaterial: ShaderMaterial;
    private basic = new MeshBasicMaterial();
    private fsQuad = new FullScreenQuad();

    /**
     * @param resolution input size in pixels (canvas size × pixel ratio); updated by `setSize`.
     * @param options.mips number of blur mips (1..MAX_MIPS); `setMips` changes it later.
     * @param options.type texture type of the bloom targets (default HalfFloatType).
     */
    constructor(
        resolution: Vector2,
        strength: number,
        radius: number,
        threshold: number,
        options: { mips?: number; type?: TextureDataType } = {},
    ) {
        super();

        this.strength = strength !== undefined ? strength : 1;
        this.radius = radius;
        this.threshold = threshold;
        this.resolution = resolution !== undefined ? new Vector2(resolution.x, resolution.y) : new Vector2(256, 256);
        this.nMips = clampMips(options.mips ?? MAX_MIPS);
        this.targetType = options.type ?? HalfFloatType;

        // render targets
        const resx = Math.max(1, Math.round(this.resolution.x / 2));
        const resy = Math.max(1, Math.round(this.resolution.y / 2));
        this.renderTargetBright = new WebGLRenderTarget(resx, resy, { type: this.targetType });
        this.renderTargetBright.texture.name = "UnrealBloomPass.bright";
        this.renderTargetBright.texture.generateMipmaps = false;

        // luminosity high pass material
        const highPassShader = LuminosityHighPassShader;
        this.highPassUniforms = UniformsUtils.clone(highPassShader.uniforms);
        this.highPassUniforms["luminosityThreshold"].value = threshold;
        this.highPassUniforms["smoothWidth"].value = 0.01;
        this.materialHighPassFilter = new ShaderMaterial({
            uniforms: this.highPassUniforms,
            vertexShader: highPassShader.vertexShader,
            fragmentShader: highPassShader.fragmentShader,
        });

        // mip targets, gaussian blur materials and composite material
        this.createMips();

        // blend material
        const copyShader = CopyShader;
        this.copyUniforms = UniformsUtils.clone(copyShader.uniforms);
        this.blendMaterial = new ShaderMaterial({
            uniforms: this.copyUniforms,
            vertexShader: copyShader.vertexShader,
            fragmentShader: copyShader.fragmentShader,
            blending: AdditiveBlending,
            depthTest: false,
            depthWrite: false,
            transparent: true,
        });

        this.enabled = true;
        this.needsSwap = false;
    }

    public get mips(): number {
        return this.nMips;
    }

    /** Changes the number of blur mips (quality.bloomMips); recreates the mip targets and blur materials. */
    setMips(mips: number) {
        const n = clampMips(mips);
        if (n === this.nMips) {
            return;
        }
        this.disposeMips();
        this.nMips = n;
        this.createMips();
    }

    dispose() {
        this.disposeMips();
        this.renderTargetBright.dispose();
        this.materialHighPassFilter.dispose();
        this.blendMaterial.dispose();
        this.basic.dispose();
        this.fsQuad.dispose();
    }

    /** Called by the composer with the drawing-buffer size (canvas size × pixel ratio, FR-051). */
    setSize(width: number, height: number) {
        this.resolution.set(width, height);

        let resx = Math.max(1, Math.round(width / 2));
        let resy = Math.max(1, Math.round(height / 2));

        this.renderTargetBright.setSize(resx, resy);

        for (let i = 0; i < this.nMips; i++) {
            this.renderTargetsHorizontal[i].setSize(resx, resy);
            this.renderTargetsVertical[i].setSize(resx, resy);

            this.separableBlurMaterials[i].uniforms["invSize"].value = new Vector2(1 / resx, 1 / resy);

            resx = Math.max(1, Math.round(resx / 2));
            resy = Math.max(1, Math.round(resy / 2));
        }
    }

    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime: number, maskActive: boolean) {
        const compositeMaterial = this.compositeMaterial!;
        renderer.getClearColor(this._oldClearColor);
        this.oldClearAlpha = renderer.getClearAlpha();
        const oldAutoClear = renderer.autoClear;
        renderer.autoClear = false;

        renderer.setClearColor(this.clearColor, 0);

        if (maskActive) renderer.state.buffers.stencil.setTest(false);

        // Render input to screen

        if (this.renderToScreen) {
            this.fsQuad.material = this.basic;
            this.basic.map = readBuffer.texture;

            renderer.setRenderTarget(null);
            renderer.clear();
            this.fsQuad.render(renderer);
        }

        // 1. Extract Bright Areas

        this.highPassUniforms["tDiffuse"].value = readBuffer.texture;
        this.highPassUniforms["luminosityThreshold"].value = this.threshold;
        this.fsQuad.material = this.materialHighPassFilter;

        renderer.setRenderTarget(this.renderTargetBright);
        renderer.clear();
        this.fsQuad.render(renderer);

        // 2. Blur All the mips progressively

        let inputRenderTarget = this.renderTargetBright;

        for (let i = 0; i < this.nMips; i++) {
            this.fsQuad.material = this.separableBlurMaterials[i];

            this.separableBlurMaterials[i].uniforms["colorTexture"].value = inputRenderTarget.texture;
            this.separableBlurMaterials[i].uniforms["direction"].value = UnrealBloomPass.BlurDirectionX;
            renderer.setRenderTarget(this.renderTargetsHorizontal[i]);
            renderer.clear();
            this.fsQuad.render(renderer);

            this.separableBlurMaterials[i].uniforms["colorTexture"].value = this.renderTargetsHorizontal[i].texture;
            this.separableBlurMaterials[i].uniforms["direction"].value = UnrealBloomPass.BlurDirectionY;
            renderer.setRenderTarget(this.renderTargetsVertical[i]);
            renderer.clear();
            this.fsQuad.render(renderer);

            inputRenderTarget = this.renderTargetsVertical[i];
        }

        // Composite All the mips

        this.fsQuad.material = compositeMaterial;
        compositeMaterial.uniforms["bloomStrength"].value = this.strength;
        compositeMaterial.uniforms["bloomRadius"].value = this.radius;

        renderer.setRenderTarget(this.renderTargetsHorizontal[0]);
        renderer.clear();
        this.fsQuad.render(renderer);

        // Blend it additively over the input texture

        this.fsQuad.material = this.blendMaterial;
        this.copyUniforms["tDiffuse"].value = this.renderTargetsHorizontal[0].texture;

        if (maskActive) renderer.state.buffers.stencil.setTest(true);

        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
            this.fsQuad.render(renderer);
        } else {
            renderer.setRenderTarget(readBuffer);
            this.fsQuad.render(renderer);
        }

        // Restore renderer settings

        renderer.setClearColor(this._oldClearColor, this.oldClearAlpha);
        renderer.autoClear = oldAutoClear;
    }

    /** Creates the mip targets, blur materials and the composite material for `nMips` at the current resolution. */
    private createMips() {
        let resx = Math.max(1, Math.round(this.resolution.x / 2));
        let resy = Math.max(1, Math.round(this.resolution.y / 2));
        for (let i = 0; i < this.nMips; i++) {
            const renderTargetHorizontal = new WebGLRenderTarget(resx, resy, { type: this.targetType });
            renderTargetHorizontal.texture.name = "UnrealBloomPass.h" + i;
            renderTargetHorizontal.texture.generateMipmaps = false;
            this.renderTargetsHorizontal.push(renderTargetHorizontal);

            const renderTargetVertical = new WebGLRenderTarget(resx, resy, { type: this.targetType });
            renderTargetVertical.texture.name = "UnrealBloomPass.v" + i;
            renderTargetVertical.texture.generateMipmaps = false;
            this.renderTargetsVertical.push(renderTargetVertical);

            const blur = this.getSeperableBlurMaterial(KERNEL_SIZES[i]);
            blur.uniforms["invSize"].value = new Vector2(1 / resx, 1 / resy);
            this.separableBlurMaterials.push(blur);

            resx = Math.max(1, Math.round(resx / 2));
            resy = Math.max(1, Math.round(resy / 2));
        }

        const composite = this.getCompositeMaterial(this.nMips);
        for (let i = 0; i < this.nMips; i++) {
            composite.uniforms["blurTexture" + (i + 1)].value = this.renderTargetsVertical[i].texture;
        }
        composite.uniforms["bloomStrength"].value = this.strength;
        composite.uniforms["bloomRadius"].value = 0.1;
        composite.uniforms["bloomFactors"].value = BLOOM_FACTORS.slice(0, this.nMips);
        composite.uniforms["bloomTintColors"].value = this.bloomTintColors.slice(0, this.nMips);
        this.compositeMaterial = composite;
    }

    private disposeMips() {
        for (const t of this.renderTargetsHorizontal) {
            t.dispose();
        }
        for (const t of this.renderTargetsVertical) {
            t.dispose();
        }
        for (const m of this.separableBlurMaterials) {
            m.dispose();
        }
        this.compositeMaterial?.dispose();
        this.compositeMaterial = null;
        this.renderTargetsHorizontal = [];
        this.renderTargetsVertical = [];
        this.separableBlurMaterials = [];
    }

    getSeperableBlurMaterial(kernelRadius: number) {
        const coefficients = [];

        for (let i = 0; i < kernelRadius; i++) {
            coefficients.push((0.39894 * Math.exp((-0.5 * i * i) / (kernelRadius * kernelRadius))) / kernelRadius);
        }

        return new ShaderMaterial({
            defines: {
                KERNEL_RADIUS: kernelRadius,
            },

            uniforms: {
                colorTexture: { value: null },
                invSize: { value: new Vector2(0.5, 0.5) }, // inverse texture size
                direction: { value: new Vector2(0.5, 0.5) },
                gaussianCoefficients: { value: coefficients }, // precomputed Gaussian coefficients
            },

            vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,

            fragmentShader: `#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = max( texture2D( colorTexture, vUv ).rgb, 0.0) * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
                        vec3 sample1 = max( texture2D( colorTexture, vUv + uvOffset ).rgb, 0.0);
						vec3 sample2 = max( texture2D( colorTexture, vUv - uvOffset ).rgb, 0.0);
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`,
        });
    }

    /** Composite of `nMips` blur textures (`blurTexture1..N`). */
    getCompositeMaterial(nMips: number) {
        const uniforms: Record<string, { value: unknown }> = {
            bloomStrength: { value: 1.0 },
            bloomFactors: { value: null },
            bloomTintColors: { value: null },
            bloomRadius: { value: 0.0 },
        };
        const declarations: string[] = [];
        const terms: string[] = [];
        for (let i = 0; i < nMips; i++) {
            uniforms["blurTexture" + (i + 1)] = { value: null };
            declarations.push(`uniform sampler2D blurTexture${i + 1};`);
            terms.push(`lerpBloomFactor(bloomFactors[${i}]) * vec4(bloomTintColors[${i}], 1.0) * texture2D(blurTexture${i + 1}, vUv)`);
        }

        return new ShaderMaterial({
            defines: {
                NUM_MIPS: nMips,
            },

            uniforms,

            vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,

            fragmentShader: `varying vec2 vUv;
				${declarations.join("\n")}
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( ${terms.join(" +\n")} );
				}`,
        });
    }
}

export { UnrealBloomPass };
