import {
    AdditiveBlending,
    Color,
    HalfFloatType,
    MeshBasicMaterial,
    ShaderMaterial,
    UniformsUtils,
    Vector2,
    Vector3,
    WebGLRenderer,
    WebGLRenderTarget,
} from "three";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader";
import { LuminosityHighPassShader } from "three/examples/jsm/shaders/LuminosityHighPassShader";

/**
 * UnrealBloomPass is inspired by the bloom pass of Unreal Engine. It creates a
 * mip map chain of bloom textures and blurs them with different radii. Because
 * of the weighted combination of mips, and because larger blurs are done on
 * higher mips, this effect provides good quality and performance.
 *
 * Reference:
 * - https://docs.unrealengine.com/latest/INT/Engine/Rendering/PostProcessEffects/Bloom/
 */
class UnrealBloomPass extends Pass {
    public static BlurDirectionX = new Vector2(1.0, 0.0);
    public static BlurDirectionY = new Vector2(0.0, 1.0);

    public strength: number;
    public radius: number;
    public threshold: number;
    public resolution: Vector2;

    private clearColor = new Color(0, 0, 0);
    private _oldClearColor = new Color();
    private oldClearAlpha = 1;
    private nMips = 5;
    private bloomTintColors = [
        new Vector3(1, 1, 1),
        new Vector3(1, 1, 1),
        new Vector3(1, 1, 1),
        new Vector3(1, 1, 1),
        new Vector3(1, 1, 1),
    ];

    private renderTargetsHorizontal: WebGLRenderTarget[] = [];
    private renderTargetsVertical: WebGLRenderTarget[] = [];
    private renderTargetBright: WebGLRenderTarget;
    private highPassUniforms: (typeof LuminosityHighPassShader)["uniforms"];
    private materialHighPassFilter: ShaderMaterial;
    private separableBlurMaterials: ShaderMaterial[] = [];
    private compositeMaterial: ShaderMaterial;
    private copyUniforms: (typeof CopyShader)["uniforms"];
    private blendMaterial: ShaderMaterial;
    private basic = new MeshBasicMaterial();
    private fsQuad = new FullScreenQuad();

    constructor(resolution: Vector2, strength: number, radius: number, threshold: number) {
        super();

        this.strength = strength !== undefined ? strength : 1;
        this.radius = radius;
        this.threshold = threshold;
        this.resolution = resolution !== undefined ? new Vector2(resolution.x, resolution.y) : new Vector2(256, 256);

        // render targets
        let resx = Math.round(this.resolution.x / 2);
        let resy = Math.round(this.resolution.y / 2);
        this.renderTargetBright = new WebGLRenderTarget(resx, resy, { type: HalfFloatType });
        this.renderTargetBright.texture.name = "UnrealBloomPass.bright";
        this.renderTargetBright.texture.generateMipmaps = false;

        for (let i = 0; i < this.nMips; i++) {
            const renderTargetHorizontal = new WebGLRenderTarget(resx, resy, { type: HalfFloatType });
            renderTargetHorizontal.texture.name = "UnrealBloomPass.h" + i;
            renderTargetHorizontal.texture.generateMipmaps = false;
            this.renderTargetsHorizontal.push(renderTargetHorizontal);

            const renderTargetVertical = new WebGLRenderTarget(resx, resy, { type: HalfFloatType });
            renderTargetVertical.texture.name = "UnrealBloomPass.v" + i;
            renderTargetVertical.texture.generateMipmaps = false;
            this.renderTargetsVertical.push(renderTargetVertical);

            resx = Math.round(resx / 2);
            resy = Math.round(resy / 2);
        }

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

        // gaussian blur materials
        const kernelSizeArray = [3, 5, 7, 9, 11];
        resx = Math.round(this.resolution.x / 2);
        resy = Math.round(this.resolution.y / 2);
        for (let i = 0; i < this.nMips; i++) {
            this.separableBlurMaterials.push(this.getSeperableBlurMaterial(kernelSizeArray[i]));
            this.separableBlurMaterials[i].uniforms["invSize"].value = new Vector2(1 / resx, 1 / resy);

            resx = Math.round(resx / 2);
            resy = Math.round(resy / 2);
        }

        // composite material
        this.compositeMaterial = this.getCompositeMaterial(this.nMips);
        this.compositeMaterial.uniforms["blurTexture1"].value = this.renderTargetsVertical[0].texture;
        this.compositeMaterial.uniforms["blurTexture2"].value = this.renderTargetsVertical[1].texture;
        this.compositeMaterial.uniforms["blurTexture3"].value = this.renderTargetsVertical[2].texture;
        this.compositeMaterial.uniforms["blurTexture4"].value = this.renderTargetsVertical[3].texture;
        this.compositeMaterial.uniforms["blurTexture5"].value = this.renderTargetsVertical[4].texture;
        this.compositeMaterial.uniforms["bloomStrength"].value = strength;
        this.compositeMaterial.uniforms["bloomRadius"].value = 0.1;

        const bloomFactors = [1.0, 0.8, 0.6, 0.4, 0.2];
        this.compositeMaterial.uniforms["bloomFactors"].value = bloomFactors;
        this.compositeMaterial.uniforms["bloomTintColors"].value = this.bloomTintColors;

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

    dispose() {
        for (const t of this.renderTargetsHorizontal) {
            t.dispose();
        }

        for (const t of this.renderTargetsVertical) {
            t.dispose();
        }

        this.renderTargetBright.dispose();

        for (const t of this.separableBlurMaterials) {
            t.dispose();
        }

        this.compositeMaterial.dispose();
        this.blendMaterial.dispose();
        this.basic.dispose();
        this.fsQuad.dispose();
    }

    setSize(width: number, height: number) {
        return;

        let resx = Math.round(width / 2);
        let resy = Math.round(height / 2);

        this.renderTargetBright.setSize(resx, resy);

        for (let i = 0; i < this.nMips; i++) {
            this.renderTargetsHorizontal[i].setSize(resx, resy);
            this.renderTargetsVertical[i].setSize(resx, resy);

            this.separableBlurMaterials[i].uniforms["invSize"].value = new Vector2(1 / resx, 1 / resy);

            resx = Math.round(resx / 2);
            resy = Math.round(resy / 2);
        }
    }

    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime: number, maskActive: boolean) {
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

        this.fsQuad.material = this.compositeMaterial;
        this.compositeMaterial.uniforms["bloomStrength"].value = this.strength;
        this.compositeMaterial.uniforms["bloomRadius"].value = this.radius;
        this.compositeMaterial.uniforms["bloomTintColors"].value = this.bloomTintColors;

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

    getCompositeMaterial(nMips: number) {
        return new ShaderMaterial({
            defines: {
                NUM_MIPS: nMips,
            },

            uniforms: {
                blurTexture1: { value: null },
                blurTexture2: { value: null },
                blurTexture3: { value: null },
                blurTexture4: { value: null },
                blurTexture5: { value: null },
                bloomStrength: { value: 1.0 },
                bloomFactors: { value: null },
                bloomTintColors: { value: null },
                bloomRadius: { value: 0.0 },
            },

            vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,

            fragmentShader: `varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`,
        });
    }
}

export { UnrealBloomPass };
