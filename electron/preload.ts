import { OpenDialogOptions, SaveDialogOptions, contextBridge, ipcRenderer } from "electron";
import { readFile, writeFile } from "fs/promises";

contextBridge.exposeInMainWorld("readFile", readFile);
contextBridge.exposeInMainWorld("writeFile", writeFile);
contextBridge.exposeInMainWorld("showOpenDialog", (options: OpenDialogOptions) => ipcRenderer.invoke("dialog:showOpenDialog", options));
contextBridge.exposeInMainWorld("showSaveDialog", (options: SaveDialogOptions) => ipcRenderer.invoke("dialog:showSaveDialog", options));
