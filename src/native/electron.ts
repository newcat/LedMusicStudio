import type { OpenDialogOptions, OpenDialogReturnValue, SaveDialogOptions, SaveDialogReturnValue } from "electron";
import type { readFile as origReadFile, writeFile as origWriteFile } from "fs/promises";
import { FileOptions, NativeAdapter, NativeAdapterType, ReadFileResult, SaveFileOptions } from "./types";
import { withTimeout } from "@/utils";

export class ElectronNativeAdapter implements NativeAdapter {
    public readonly type = NativeAdapterType.ELECTRON;

    public readonly readFile = (window as any).readFile as typeof origReadFile;
    public readonly writeFile = (window as any).writeFile as typeof origWriteFile;
    public readonly showOpenDialog = (window as any).showOpenDialog as (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>;
    public readonly showSaveDialog = (window as any).showSaveDialog as (options: SaveDialogOptions) => Promise<SaveDialogReturnValue>;

    public isElectron(): this is ElectronNativeAdapter {
        return true;
    }

    public isBrowser(): this is never {
        return false;
    }

    public async chooseAndReadFile(options?: FileOptions): Promise<ReadFileResult | null> {
        const result = await this.showOpenDialog({
            filters: options?.accept,
        });
        if (result.canceled) {
            return null;
        }
        const filePath = result.filePaths[0];
        const data = await withTimeout(() => this.readFile(filePath), "Timeout while reading data");
        return new ReadFileResult(data, filePath);
    }

    public async chooseAndWriteFile(data: Uint8Array, options?: SaveFileOptions): Promise<boolean> {
        const result = await this.showSaveDialog({
            filters: options?.accept,
            defaultPath: options?.suggestedName,
        });
        if (result.canceled || !result.filePath) {
            return false;
        }
        await this.writeFile(result.filePath, data);
        return true;
    }
}
