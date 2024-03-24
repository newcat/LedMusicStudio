import { Ref, nextTick, onMounted, ref, watch } from "vue";

export function useEditClone<T>(original: Ref<T>) {
    const clone = ref<T>(JSON.parse(JSON.stringify(original.value)) as T) as Ref<T>;
    const dirty = ref(false);

    watch(
        clone,
        () => {
            dirty.value = true;
        },
        { deep: true }
    );

    function save() {
        original.value = clone.value;
        dirty.value = false;
    }

    onMounted(async () => {
        clone.value = JSON.parse(JSON.stringify(original.value)) as T;
        await nextTick();
        dirty.value = false;
    });

    return { clone, dirty, save };
}
