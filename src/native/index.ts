import type {
    ipcRenderer as origIpcRenderer,
    OpenDialogOptions,
    OpenDialogReturnValue,
    SaveDialogOptions,
    SaveDialogReturnValue,
} from "electron";
import type { readFile as origReadFile, writeFile as origWriteFile } from "fs/promises";

export const readFile = (window as any).readFile as typeof origReadFile;
export const writeFile = (window as any).writeFile as typeof origWriteFile;
export const ipcRenderer = (window as any).ipcRenderer as typeof origIpcRenderer;

export async function showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
    return await ipcRenderer.invoke("dialog:showOpenDialog", options);
}

export async function showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogReturnValue> {
    return await ipcRenderer.invoke("dialog:showSaveDialog", options);
}
