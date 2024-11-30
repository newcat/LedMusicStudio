import { watchEffect } from "vue";
import { SelectInterface } from "baklavajs";
import { BaseFixture, FixtureType, useStage } from "@/stage";

export class SelectFixtureInterface extends SelectInterface {
    private readonly stage = useStage();
    private unwatch?: () => void;

    constructor(private compatibleFixtureTypes: FixtureType[]) {
        super("Fixture", "", []);
        this.setPort(false);
        this.unwatch = watchEffect(() => this.updateFixtures());
    }

    public get selectedFixture(): BaseFixture | undefined {
        if (!this.value) {
            return;
        }

        return this.stage.fixtures.get(this.value) as BaseFixture;
    }

    public destroy() {
        this.unwatch?.();
    }

    private updateFixtures() {
        const optionItems: { text: string; value: string }[] = [];
        for (const fixture of this.stage.fixtures.values()) {
            if (this.compatibleFixtureTypes.includes(fixture.type)) {
                optionItems.push({ text: fixture.name, value: fixture.id });
            }
        }
        this.items = optionItems;
        this.events.updated.emit();
    }
}
