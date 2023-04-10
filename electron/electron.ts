import * as path from "path";
import { app, BrowserWindow, dialog, ipcMain, OpenDialogOptions, SaveDialogOptions } from "electron";
import installExtension, { VUEJS3_DEVTOOLS } from "electron-devtools-installer";

import "./serialport";
import "./dgram";

let mainWindow: BrowserWindow;
const isDev = process.env.IS_DEV == "true" ? true : false;

async function showOpenDialog(options: OpenDialogOptions) {
    return await dialog.showOpenDialog(mainWindow, options);
}

async function showSaveDialog(options: SaveDialogOptions) {
    return await dialog.showSaveDialog(mainWindow, options);
}

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: true,
        },
        autoHideMenuBar: true,
    });

    // and load the index.html of the app.
    // win.loadFile("index.html");
    mainWindow.loadURL(isDev ? "http://localhost:3000" : `file://${path.join(__dirname, "../dist/index.html")}`);
    // Open the DevTools.
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    const filter = {
        urls: ["https://open-fixture-library.org/download.ofl"],
    };
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
        delete details.requestHeaders["Origin"];
        callback({ requestHeaders: details.requestHeaders });
    });
    mainWindow.webContents.session.webRequest.onHeadersReceived(filter, (details, callback) => {
        details.responseHeaders = {
            ...details.responseHeaders,
            "Access-Control-Allow-Origin": [isDev ? "http://localhost:3000" : "capacitor-electron://-"],
        };
        callback({ responseHeaders: details.responseHeaders });
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    ipcMain.handle("dialog:showOpenDialog", (ev, args) => showOpenDialog(args));
    ipcMain.handle("dialog:showSaveDialog", (ev, args) => showSaveDialog(args));
    createWindow();
    app.on("activate", function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    /*installExtension(VUEJS3_DEVTOOLS)
        .then((name) => console.log(`Added Extension:  ${name}`))
        .catch((err) => console.log("An error occurred: ", err));*/
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
