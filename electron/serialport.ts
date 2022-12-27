import { SerialPort } from "serialport";
import { ipcMain } from "electron";

const openPorts = new Map<string, SerialPort>();

ipcMain.on("RESET", () => {
    openPorts.forEach((p) => {
        p.close();
    });
    openPorts.clear();
});

ipcMain.handle("SERIALPORT_OPEN", (ev, id: string, port: string) => {
    return open(id, port);
});

ipcMain.handle("SERIALPORT_SEND", (ev, id: string, data: Buffer) => {
    return send(id, data);
});

ipcMain.handle("SERIALPORT_CLOSE", (ev, id: string) => {
    return close(id);
});

async function open(id: string, port: string) {
    await close(id);

    const sp = new SerialPort({
        path: port,
        baudRate: 115200,
        parity: "none",
        dataBits: 8,
        stopBits: 1,
    });
    openPorts.set(id, sp);

    return new Promise((res) => {
        sp.on("open", () => {
            res({ success: true });
        });
        sp.on("error", (err) => {
            openPorts.delete(id);
            res({ success: false, err });
        });
    });
}

async function send(id: string, data: Buffer) {
    const sp = openPorts.get(id);
    if (!sp) {
        return { success: true };
    }
    return new Promise((res) => {
        sp.write(data, (err) => {
            if (err) {
                res({ success: false, err });
            }
            res({ success: true });
        });
    });
}

async function close(id: string) {
    const sp = openPorts.get(id);
    if (!sp) {
        return { success: false, err: new Error("Unknown id: " + id) };
    }
    return new Promise((res) => {
        sp.close((err) => {
            if (err) {
                res({ success: false, err });
            }
            res({ success: true });
        });
    });
}
