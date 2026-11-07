import { ref, watch, type Ref } from "vue";

/**
 * Local editable copy of a config that is pushed to `onUpdate` on every change (no "Apply" button) and
 * re-synced when the source changes from outside (e.g. undo).
 */
export function useLiveConfig<T>(source: Ref<T>, onUpdate: (config: T) => void): Ref<T> {
    const copy = <V>(value: V) => JSON.parse(JSON.stringify(value)) as V;
    const clone = ref(copy(source.value)) as Ref<T>;

    watch(
        clone,
        (value) => {
            if (JSON.stringify(value) !== JSON.stringify(source.value)) {
                onUpdate(copy(value));
            }
        },
        { deep: true }
    );
    watch(
        source,
        (value) => {
            if (JSON.stringify(value) !== JSON.stringify(clone.value)) {
                clone.value = copy(value);
            }
        },
        { deep: true }
    );

    return clone;
}
