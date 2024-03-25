import { v4 as uuidv4 } from "uuid";
import { LibraryItem, LibraryItemType } from "@/library";
import { TICKS_PER_BEAT } from "@/constants";
import { BaklavaEvent } from "@baklavajs/events";

export type AutomationPointType = "linear" | "step";

export interface IAutomationPoint {
    id: string;
    unit: number;
    value: number;
    type: AutomationPointType;
}

export interface AutomationLibraryItemState {
    points: IAutomationPoint[];
}

export class AutomationLibraryItem extends LibraryItem<AutomationLibraryItemState> {
    public type = LibraryItemType.AUTOMATION;
    public name = "Automation Clip";

    public points: IAutomationPoint[] = [
        { id: uuidv4(), unit: 0, value: 0.5, type: "linear" },
        { id: uuidv4(), unit: TICKS_PER_BEAT * 4, value: 0.5, type: "linear" },
    ];

    public events = {
        pointsUpdated: new BaklavaEvent<void, this>(this),
    };

    public get firstValue() {
        return this.points.length > 0 ? this.points[0].value : 0;
    }
    public get lastValue() {
        return this.points.length > 0 ? this.points[this.points.length - 1].value : 0;
    }

    public addPoint(unit: number, value: number, type: AutomationPointType = "linear") {
        this.points.push({ id: uuidv4(), unit, value, type });
        this.sortPoints();
        this.events.pointsUpdated.emit();
    }

    public removePoint(id: string) {
        this.points = this.points.filter((p) => p.id !== id);
        this.events.pointsUpdated.emit();
    }

    public sortPoints() {
        this.points.sort((a, b) => a.unit - b.unit);
    }

    public getValueAt(unit: number) {
        for (let i = this.points.length - 1; i >= 0; i--) {
            const p = this.points[i];
            if (p.unit > unit) {
                continue;
            }
            const firstPoint = this.points[i];

            if (i + 1 >= this.points.length) {
                // this is the last point we have, therefore return its value
                return firstPoint.value;
            }

            const secondPoint = this.points[i + 1];

            switch (secondPoint.type) {
                case "linear":
                    return this.linearInterpolation(unit, firstPoint, secondPoint);
                case "step":
                    return firstPoint.value;
            }
        }
        return 0;
    }

    public override save() {
        return {
            points: this.points,
        };
    }

    public override load(state: AutomationLibraryItemState) {
        this.points = state.points;
    }

    private linearInterpolation(unit: number, a: IAutomationPoint, b: IAutomationPoint) {
        const diff = b.unit - a.unit;
        if (diff === 0) {
            return b.value;
        }
        return a.value + (b.value - a.value) * ((unit - a.unit) / diff);
    }
}
