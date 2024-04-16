import * as THREE from "three";

import { VisualizationType } from "./fixtureVisualizations/types";
import type { BaseRenderer } from "./fixtureVisualizations/base.renderer";
import { LedStripRenderer } from "./fixtureVisualizations/ledStrip/ledStrip.renderer";
import { SpotRenderer } from "./fixtureVisualizations/spot/spot.renderer";
import { Ref } from "vue";

type FixtureRenderers = {
    [VisualizationType.LED_STRIP]: LedStripRenderer;
    [VisualizationType.SPOT]: SpotRenderer;
};
type FixtureRendererConfig<T extends VisualizationType> = FixtureRenderers[T] extends BaseRenderer<infer C> ? C : never;
type FixtureRendererValue<T extends VisualizationType> = FixtureRenderers[T] extends BaseRenderer<any, infer V> ? V : never;

function getFixtureRendererType<T extends VisualizationType>(visualizationType: T): new () => FixtureRenderers[T] {
    switch (visualizationType) {
        case VisualizationType.LED_STRIP:
            return LedStripRenderer as any;
        case VisualizationType.SPOT:
            return SpotRenderer as any;
        default:
            throw new Error(`No renderer for visualization type ${visualizationType}`);
    }
}

export interface RemoteStageRenderer {
    createFixtureRenderer<T extends VisualizationType>(
        fixtureId: string,
        visualizationType: T,
        initialConfig: FixtureRendererConfig<T>
    ): Promise<void>;
    onFixtureConfigUpdate<T extends VisualizationType>(fixtureId: string, config: FixtureRendererConfig<T>): Promise<void>;
    onFixtureValueUpdate<T extends VisualizationType>(fixtureId: string, value: FixtureRendererValue<T>): Promise<void>;
    setCanvas(canvas: OffscreenCanvas | null): Promise<void>;
    setCanvasSize(width: number, height: number): Promise<void>;
    setActive(loading: boolean): Promise<void>;
    removeFixtureRenderer(fixtureId: string): Promise<void>;
    loadScene(scene: any): Promise<void>;
    reset(): Promise<void>;
}

export class StageRenderer {
    private _scene: THREE.Scene | null = null;
    private _camera: THREE.PerspectiveCamera | null = null;
    private _fixtureRenderers: Map<string, BaseRenderer> = new Map();

    private active = false;
    private renderer: THREE.WebGLRenderer | null = null;
    private canvas: HTMLCanvasElement | null = null;

    public get fixtureRenderers() {
        return this._fixtureRenderers as ReadonlyMap<string, BaseRenderer>;
    }

    public get scene() {
        return this._scene;
    }

    public get camera() {
        return this._camera;
    }

    public constructor(private readonly sceneLoadedRef: Ref<boolean>) {
        sceneLoadedRef.value = false;
        this.render();
    }

    public setCanvas(canvas: HTMLCanvasElement | null) {
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }

        this.canvas = canvas;
        if (canvas) {
            this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        }
    }

    public setCanvasSize(width: number, height: number) {
        if (this.canvas) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
        if (this.renderer) {
            this.renderer.setSize(width, height, false);
        }
    }

    public setActive(active: boolean) {
        this.active = active;
    }

    public createFixtureRenderer<T extends VisualizationType>(
        fixtureId: string,
        visualizationType: T,
        initialConfig: FixtureRendererConfig<T>
    ) {
        this.removeFixtureRenderer(fixtureId);
        const newRenderer = new (getFixtureRendererType<T>(visualizationType))();
        newRenderer.onConfigUpdate(initialConfig as any);
        this._fixtureRenderers.set(fixtureId, newRenderer);
        this._scene?.add(newRenderer);
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
            this._fixtureRenderers.delete(fixtureId);
        }
    }

    public loadScene(baseScene: any) {
        const loader = new THREE.ObjectLoader();
        this._scene = loader.parse(baseScene) as THREE.Scene;
        this.sceneLoadedRef.value = true;

        this._camera = this._scene.children.find((child) => child.type === "PerspectiveCamera") as THREE.PerspectiveCamera;
        if (!this.camera) {
            throw new Error("No camera found in scene");
        }

        for (const fixtureRenderer of this.fixtureRenderers.values()) {
            this._scene.add(fixtureRenderer);
        }
    }

    public reset() {
        for (const visualization of this.fixtureRenderers.values()) {
            visualization.dispose();
        }
        this._fixtureRenderers.clear();
    }

    private render() {
        requestAnimationFrame(() => this.render());

        if (!this.renderer || !this.scene || !this.camera || !this.active) {
            return;
        }

        this.renderer.render(this.scene, this.camera);
    }
}
