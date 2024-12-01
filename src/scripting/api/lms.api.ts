import { DmxFixture, useStage } from "@/stage";

export class LMSDmxFixtureImpl implements LMSDmxFixture {
    public static fromFixture(fixture: DmxFixture): LMSDmxFixtureImpl {
        return new LMSDmxFixtureImpl(fixture);
    }

    public readonly type = "dmx";

    private constructor(private readonly fixture: DmxFixture) {}

    public setValue(channel: number, value: number): void {
        const valueCopy = [...this.fixture.value];
        valueCopy[channel] = value;
        this.fixture.setValue(valueCopy);
    }
}

export class LMSFixturesApiImpl implements LMSFixturesApi {
    findFixtureByName(name: string): LMSDmxFixture | null {
        const stage = useStage();
        const fixture = Array.from(stage.fixtures.values()).find((f) => f.name === name);
        if (fixture instanceof DmxFixture) {
            return LMSDmxFixtureImpl.fromFixture(fixture);
        }
        return null;
    }
}

export class LMSStageApiImpl implements LMSStageApi {
    readonly fixtures = new LMSFixturesApiImpl();
}

export class LMSApiImpl implements LMSApi {
    public readonly stage = new LMSStageApiImpl();
}
