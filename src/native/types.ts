import type { BrowserNativeAdapter } from "./browser";
import type { ElectronNativeAdapter } from "./electron";

export class ReadFileResult {
    public constructor(public readonly data: Uint8Array, public readonly path: string) {}

    public get dataAsString() {
        return new TextDecoder().decode(this.data);
    }
}

export interface FileOptions {
    accept?: Array<{ name: string; extensions: string[] }>;
}

export interface SaveFileOptions extends FileOptions {
    suggestedName?: string;
}

export enum NativeAdapterType {
    ELECTRON = "Electron",
    BROWSER = "Browser",
}

export interface NativeAdapter {
    readonly type: NativeAdapterType;
    chooseAndReadFile(options?: FileOptions): Promise<ReadFileResult | null>;
    chooseAndWriteFile(data: Uint8Array, options?: SaveFileOptions): Promise<boolean>;
    isElectron(): this is ElectronNativeAdapter;
    isBrowser(): this is BrowserNativeAdapter;
}
