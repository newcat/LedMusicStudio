const { contextBridge, ipcRenderer } = require("electron");
const { readFile, writeFile } = require("fs/promises");
const { createSocket } = require("dgram");

contextBridge.exposeInMainWorld("readFile", readFile);
contextBridge.exposeInMainWorld("writeFile", writeFile);
contextBridge.exposeInMainWorld("ipcRenderer", ipcRenderer);
contextBridge.exposeInMainWorld("dgramCreateSocket", createSocket);
