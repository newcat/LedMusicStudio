import { Ref } from "vue";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass";

import { VisualizationType } from "./fixtureVisualization";
import type { BaseRenderer, RendererInputs } from "./fixtureVisualizations/base.renderer";
import { LedStripRenderer } from "./fixtureVisualizations/ledStrip/ledStrip.renderer";
import { SpotRenderer } from "./fixtureVisualizations/spot/spot.renderer";
import { MovingHeadRenderer } from "./fixtureVisualizations/movingHead/movingHead.renderer";

type FixtureRenderers = {
    [VisualizationType.LED_STRIP]: LedStripRenderer;
    [VisualizationType.SPOT]: SpotRenderer;
    [VisualizationType.MOVING_HEAD]: MovingHeadRenderer;
};
type FixtureRendererConfig<T extends VisualizationType> = FixtureRenderers[T] extends BaseRenderer<infer C> ? C : never;
type FixtureRendererValue<T extends VisualizationType> = FixtureRenderers[T] extends BaseRenderer<any, infer V> ? V : never;

function getFixtureRendererType<T extends VisualizationType>(visualizationType: T): new (inputs: RendererInputs) => FixtureRenderers[T] {
    switch (visualizationType) {
        case VisualizationType.LED_STRIP:
            return LedStripRenderer as any;
        case VisualizationType.SPOT:
            return SpotRenderer as any;
        case VisualizationType.MOVING_HEAD:
            return MovingHeadRenderer as any;
        default:
            throw new Error(`No renderer for visualization type ${visualizationType}`);
    }
}

export interface StageRendererPayloads {
    createFixtureRenderer: [string, VisualizationType, FixtureRendererConfig<VisualizationType>];
    onFixtureConfigUpdate: [string, FixtureRendererConfig<VisualizationType>];
    onFixtureValueUpdate: [string, FixtureRendererValue<VisualizationType>];
    removeFixtureRenderer: [string];
    loadScene: [any];
    reset: [];
}

export interface StageRendererMessage<T extends keyof StageRendererPayloads> {
    type: T;
    payload: StageRendererPayloads[T];
}

export class RenderingInstance {
    private continueRendering = true;

    private fixtureRenderers: Map<string, BaseRenderer> = new Map();
    private renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    private bloomPass: UnrealBloomPass;

    public constructor(
        canvas: HTMLCanvasElement,
        private readonly scene: THREE.Scene,
        private readonly camera: THREE.PerspectiveCamera,
    ) {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 4;

        const renderScene = new RenderPass(scene, camera);
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(canvas.width, canvas.height), 0.2, 0, 0.5);
        const outputPass = new OutputPass();

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(this.bloomPass);
        this.composer.addPass(outputPass);

        this.render();
    }

    public resize(width: number, height: number) {
        this.renderer.setSize(width, height, false);
        this.composer.setSize(width, height);
        this.bloomPass.resolution.set(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    public createFixtureRenderer<T extends VisualizationType>(
        fixtureId: string,
        visualizationType: T,
        initialConfig: FixtureRendererConfig<T>,
    ) {
        this.removeFixtureRenderer(fixtureId);
        const newRenderer = new (getFixtureRendererType<T>(visualizationType))({
            camera: this.camera,
        });
        newRenderer.onConfigUpdate(initialConfig as any);
        this.fixtureRenderers.set(fixtureId, newRenderer);
        this.scene.add(newRenderer);
    }

    public onFixtureConfigUpdate<T extends VisualizationType>(fixtureId: string, config: FixtureRendererConfig<T>) {
        const fixtureRenderer = this.fixtureRenderers.get(fixtureId);
        if (fixtureRenderer) {
            fixtureRenderer.onConfigUpdate(config);
        }
    }

    public onFixtureValueUpdate<T extends VisualizationType>(fixtureId: string, value: FixtureRendererValue<T>) {
        const fixtureRenderer = this.fixtureRenderers.get(fixtureId);
        if (fixtureRenderer) {
            fixtureRenderer.onFixtureValueUpdate(value);
        }
    }

    public removeFixtureRenderer(fixtureId: string) {
        const fixtureRenderer = this.fixtureRenderers.get(fixtureId);
        if (fixtureRenderer) {
            this.scene?.remove(fixtureRenderer);
            fixtureRenderer.dispose();
            this.fixtureRenderers.delete(fixtureId);
        }
    }

    public dispose() {
        this.continueRendering = false;
        this.renderer.dispose();
        this.composer.dispose();
    }

    private render() {
        if (!this.continueRendering) {
            return;
        }

        requestAnimationFrame(() => this.render());
        this.composer.render();
    }
}

export class StageRenderer {
    private readonly bc: BroadcastChannel;
    private renderingInstance: RenderingInstance | null = null;

    public constructor(
        private readonly sceneLoadedRef: Ref<boolean>,
        private readonly canvas: HTMLCanvasElement,
    ) {
        sceneLoadedRef.value = false;

        this.bc = new BroadcastChannel("visualization");
        this.bc.addEventListener("message", (ev) => {
            const data = JSON.parse(ev.data) as StageRendererMessage<keyof StageRendererPayloads>;
            if (data.type === "createFixtureRenderer") {
                this.renderingInstance?.createFixtureRenderer(...(data as StageRendererMessage<"createFixtureRenderer">).payload);
            } else if (data.type === "onFixtureConfigUpdate") {
                this.renderingInstance?.onFixtureConfigUpdate(...(data as StageRendererMessage<"onFixtureConfigUpdate">).payload);
            } else if (data.type === "onFixtureValueUpdate") {
                this.renderingInstance?.onFixtureValueUpdate(...(data as StageRendererMessage<"onFixtureValueUpdate">).payload);
            } else if (data.type === "removeFixtureRenderer") {
                this.renderingInstance?.removeFixtureRenderer(...(data as StageRendererMessage<"removeFixtureRenderer">).payload);
            } else if (data.type === "loadScene") {
                this.loadScene(...(data as StageRendererMessage<"loadScene">).payload);
            } else if (data.type === "reset") {
                this.reset();
            }
        });

        this.bc.postMessage(JSON.stringify({ type: "ready" }));
    }

    public setCanvasSize(width: number, height: number) {
        if (this.canvas) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
        this.renderingInstance?.resize(width, height);
    }

    public loadScene(baseScene: any) {
        const loader = new THREE.ObjectLoader();
        const scene = loader.parse("scene" in baseScene ? baseScene.scene : baseScene) as THREE.Scene;
        this.sceneLoadedRef.value = true;

        const camera = scene.children.find((child) => child.type === "PerspectiveCamera") as THREE.PerspectiveCamera;
        if (!camera) {
            throw new Error("No camera found in scene");
        }

        this.renderingInstance = new RenderingInstance(this.canvas, scene, camera);
    }

    public reset() {
        this.renderingInstance?.dispose();
    }
}
