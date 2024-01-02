import { contextBridge, ipcRenderer } from "electron";
import { readFile, writeFile } from "fs/promises";

contextBridge.exposeInMainWorld("readFile", readFile);
contextBridge.exposeInMainWorld("writeFile", writeFile);
contextBridge.exposeInMainWorld("ipcRenderer", ipcRenderer);
