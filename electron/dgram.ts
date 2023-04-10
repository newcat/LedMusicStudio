import { Socket, createSocket } from "dgram";
import { ipcMain } from "electron";

const openSockets = new Map<string, Socket>();

ipcMain.on("RESET", () => {
    openSockets.forEach((s) => {
        s.close();
    });
    openSockets.clear();
});

ipcMain.handle("DGRAM_OPEN", (ev, id: string) => {
    return open(id);
});

ipcMain.handle("DGRAM_SEND", (ev, id: string, host: string, port: number, data: Buffer) => {
    return send(id, host, port, data);
});

ipcMain.handle("DGRAM_CLOSE", (ev, id: string) => {
    return close(id);
});

function open(id: string) {
    close(id);
    openSockets.set(id, createSocket("udp4"));
    return { success: true };
}

async function send(id: string, host: string, port: number, data: Buffer) {
    const sock = openSockets.get(id);
    if (!sock) {
        return { success: true };
    }
    return await new Promise((res) => {
        sock.send(data, port, host, (err) => {
            if (err) {
                res({ success: false, err });
            } else {
                res({ success: true });
            }
        });
    });
}

function close(id: string) {
    const sock = openSockets.get(id);
    if (!sock) {
        return { success: false, err: new Error("Unknown id: " + id) };
    }
    sock.close();
    return { success: true };
}
