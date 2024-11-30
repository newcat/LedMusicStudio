import { scaleColorArray } from "@/utils";
import { FixtureType, LedStripFixture } from "@/stage/fixtures";
import { ChromaApi } from "./chromaApi";
import { BaseController, ControllerType } from "../base.controller";

export class RazerChromaController extends BaseController<Record<string, never>, LedStripFixture> {
    public readonly type = ControllerType.RAZER_CHROMA;
    public readonly compatibleFixtures = [FixtureType.LED_STRIP];

    private api = new ChromaApi();
    private isSending = false;

    public override get validationErrors(): string[] {
        return [];
    }

    public constructor() {
        super({});
        void this.api.initialize();
        this.name = "Razer Chroma Controller";
    }

    public override addFixture(f: LedStripFixture): void {
        if (this.controlledFixtures.length > 0) {
            throw new Error("WLED controller can only control one fixture");
        }
        super.addFixture(f);
    }

    public async send(): Promise<void> {
        if (this.isSending || this.controlledFixtures.length === 0) {
            // skip this frame
            return;
        }

        const fixture = this.controlledFixtures[0];
        const colors = scaleColorArray(fixture.value, 22);
        const row: number[] = [];
        for (const c of colors) {
            row.push(256 * 256 * c[2] + 256 * c[1] + c[0]);
        }

        const data = [row, row, row, row, row, row];

        this.isSending = true;
        await this.api.send(data);
        this.isSending = false;
    }

    public async dispose(): Promise<void> {
        await this.api.destroy();
    }
}
