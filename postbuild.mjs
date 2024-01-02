import * as fs from "node:fs/promises";

async function main() {
    await fs.rename("electron-dist/preload.js", "electron-dist/preload.mjs");
}

main();
