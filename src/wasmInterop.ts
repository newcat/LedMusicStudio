import type * as WasmModuleNs from "./rust/pkg/rust";

export interface WasmModule {
    CalculationData: typeof WasmModuleNs.CalculationData;
    Particle: typeof WasmModuleNs.Particle;
    ParticleNode: typeof WasmModuleNs.ParticleNode;
}

export type CalculationData = typeof WasmModuleNs.CalculationData;
export type Particle = typeof WasmModuleNs.Particle;
export type ParticleNode = typeof WasmModuleNs.ParticleNode;

class WasmInterop {
    private _wasmModule: WasmModule | null = null;

    public get wasmModule() {
        if (!this._wasmModule) {
            throw new Error("WASM module not initialized yet.");
        } else {
            return this._wasmModule;
        }
    }

    public async init() {
        const module = await import("./rust/pkg/rust");
        module.init();
        this._wasmModule = module as any;
    }
}

export const wasmInterop = new WasmInterop();
