import { watchEffect } from "vue";
import { SelectInterface } from "baklavajs";
import { FixtureType, useStage } from "@/stage";

/**
 * Target of an Attribute Output node (feature 004): "clip" (the timeline item's target), a group ("group:<id>") or
 * a DMX fixture ("fixture:<id>"). The options follow the stage.
 */
export class SelectTargetInterface extends SelectInterface<string> {
    private readonly stage = useStage();
    private unwatch?: () => void;

    public constructor() {
        super("Target", "clip", []);
        this.setPort(false);
        this.unwatch = watchEffect(() => this.updateItems());
    }

    public destroy() {
        this.unwatch?.();
    }

    private updateItems() {
        const items: Array<{ text: string; value: string }> = [{ text: "Clip target", value: "clip" }];
        for (const group of this.stage.groups) {
            items.push({ text: `Group: ${group.name}`, value: `group:${group.id}` });
        }
        for (const fixture of this.stage.fixtures.values()) {
            if (fixture.type === FixtureType.DMX) {
                items.push({ text: fixture.name, value: `fixture:${fixture.id}` });
            }
        }
        this.items = items;
        this.events.updated.emit();
    }
}
