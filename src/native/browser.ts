import { FileOptions, NativeAdapter, NativeAdapterType, ReadFileResult } from "./types";

export class BrowserNativeAdapter implements NativeAdapter {
    public readonly type = NativeAdapterType.BROWSER;

    public isElectron(): this is never {
        return false;
    }

    public isBrowser(): this is BrowserNativeAdapter {
        return true;
    }

    public async chooseAndReadFile(options?: FileOptions): Promise<ReadFileResult | null> {
        const input = document.createElement("input");
        input.type = "file";
        if (options?.accept) {
            input.accept = options.accept
                .flatMap((x) => x.extensions)
                .map((ext) => (ext.endsWith("*") ? ext : `.${ext}`))
                .join(",");
        }
        return new Promise((resolve) => {
            input.addEventListener("cancel", () => {
                resolve(null);
            });
            input.onchange = () => {
                const file = input.files?.[0];
                if (!file) {
                    return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                    const data = new Uint8Array(reader.result as ArrayBuffer);
                    resolve(new ReadFileResult(data, file.name));
                };
                reader.readAsArrayBuffer(file);
            };
            input.click();
        });
    }

    public async chooseAndWriteFile(data: Uint8Array, options?: FileOptions): Promise<boolean> {
        const blob = new Blob([data], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        if (options?.accept) {
            a.download = `file.${options.accept[0].extensions[0]}`;
        }
        a.click();
        return true;
    }
}
