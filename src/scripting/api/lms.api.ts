import { scriptRuntime } from "./runtime";

/**
 * The legacy `lmsApi` global.
 *
 * Everything here is superseded by the generated `stage` and `tracks` globals, which are checked against the fixtures that
 * actually exist. It delegates to the same handles so the two paths cannot behave differently.
 */
export class LMSFixturesApiImpl implements LMSFixturesApi {
    public findFixtureByName(name: string): LMSDmxFixture | null {
        const handle = scriptRuntime.stage[name];
        return handle?.type === "dmx" ? handle : null;
    }
}

export class LMSStageApiImpl implements LMSStageApi {
    public readonly fixtures = new LMSFixturesApiImpl();
}

export class LMSApiImpl implements LMSApi {
    public readonly stage = new LMSStageApiImpl();
}

export const lmsApi = new LMSApiImpl();
