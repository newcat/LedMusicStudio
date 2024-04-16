function isDisposable(obj: unknown): obj is { dispose: () => void } {
    return typeof obj === "object" && obj !== null && "dispose" in obj && typeof (obj as { dispose: unknown }).dispose === "function";
}

export class ExtendedMap<K, V> extends Map<K, V> {
    public getArray(): V[] {
        return Array.from(this.values());
    }

    public override clear(): void {
        for (const value of this.values()) {
            if (isDisposable(value)) {
                value.dispose();
            }
        }

        super.clear();
    }

    public override delete(key: K): boolean {
        const value = this.get(key);
        if (value !== undefined && isDisposable(value)) {
            value.dispose();
        }

        return super.delete(key);
    }

    public override set(key: K, value: V): this {
        const oldValue = this.get(key);
        if (oldValue !== undefined && isDisposable(oldValue)) {
            oldValue.dispose();
        }

        return super.set(key, value);
    }
}
