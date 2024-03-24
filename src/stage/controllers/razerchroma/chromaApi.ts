import type { AxiosInstance } from "axios";

export class ChromaApi {
    private client?: AxiosInstance;
    private keepaliveTimer?: ReturnType<typeof setTimeout>;

    public async initialize() {
        const axios = (await import("axios")).default;

        const r = await axios.post("http://localhost:54235/razer/chromasdk", {
            title: "LedMusic",
            description: "LedMusic Razer Output",
            author: {
                name: "Frederik Wagner",
                contact: "https://github.com/newcat/LedMusic3",
            },
            device_supported: ["keyboard"],
            category: "application",
        });
        this.client = axios.create({
            baseURL: r.data.uri,
        });
        this.resetTimer();
    }

    public async send(colors: number[][]): Promise<boolean> {
        if (!this.client) {
            return false;
        }
        try {
            await this.client.put("/keyboard", {
                effect: "CHROMA_CUSTOM",
                param: colors,
            });
            this.resetTimer();
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    }

    public async destroy() {
        if (this.keepaliveTimer) {
            clearTimeout(this.keepaliveTimer);
        }
        if (this.client) {
            await this.client.delete("/");
        }
    }

    private resetTimer() {
        if (this.keepaliveTimer) {
            clearTimeout(this.keepaliveTimer);
        }
        this.keepaliveTimer = setTimeout(() => void this.sendHeartbeat(), 10000);
    }

    private async sendHeartbeat() {
        if (!this.client) {
            return;
        }
        await this.client.put("/heartbeat");
        this.resetTimer();
    }
}
