import type { dialog as origDialog, ipcRenderer as origIpcRenderer } from "electron";
import type { readFile as origReadFile, writeFile as origWriteFile } from "fs/promises";

export const dialog = (window as any).dialog as typeof origDialog;
export const readFile = (window as any).readFile as typeof origReadFile;
export const writeFile = (window as any).writeFile as typeof origWriteFile;
export const ipcRenderer = (window as any).ipcRenderer as typeof origIpcRenderer;
