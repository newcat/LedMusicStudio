const { contextBridge, dialog, ipcRenderer } = require("electron");
const { readFile, writeFile } = require("fs/promises");

contextBridge.exposeInMainWorld("dialog", dialog);
contextBridge.exposeInMainWorld("readFile", readFile);
contextBridge.exposeInMainWorld("writeFile", writeFile);
contextBridge.exposeInMainWorld("ipcRenderer", ipcRenderer);
