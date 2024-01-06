import type { NativeAdapter } from "./types";
import type { ElectronNativeAdapter } from "./electron";
import type { BrowserNativeAdapter } from "./browser";

export * from "./types";

const userAgent = navigator.userAgent.toLowerCase();

let nativeAdapter: ElectronNativeAdapter | BrowserNativeAdapter;

export async function initializeNativeAdapter() {
    if (userAgent.indexOf(" electron/") > -1) {
        nativeAdapter = new (await import("./electron")).ElectronNativeAdapter();
    } else {
        nativeAdapter = new (await import("./browser")).BrowserNativeAdapter();
    }
}

export function getNativeAdapter(): NativeAdapter {
    if (!nativeAdapter) {
        throw new Error("Trying to use native adapter before it was initialized");
    }
    return nativeAdapter;
}
