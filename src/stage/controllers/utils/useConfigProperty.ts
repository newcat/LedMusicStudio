import { Ref, WritableComputedRef, computed } from "vue";
import { BaseController } from "../base.controller";

export function useConfigProperty<Config, P extends keyof Config>(
    controller: Ref<BaseController<Config>>,
    property: P
): WritableComputedRef<Config[P]> {
    return computed({
        get: () => controller.value.config[property],
        set: (value: Config[P]) => {
            const newConfig = { ...controller.value.config, [property]: value };
            controller.value.setConfig(newConfig);
        },
    });
}

type ControllerProperties<Config extends Record<string, any>> = {
    [P in keyof Config]: WritableComputedRef<Config[P]>;
};
export function useConfigProperties<Config extends Record<string, any>>(
    controller: Ref<BaseController<Config>>
): ControllerProperties<Config> {
    const properties: Partial<ControllerProperties<Config>> = {};
    for (const key in controller.value.config) {
        properties[key] = useConfigProperty(controller, key);
    }
    return properties as ControllerProperties<Config>;
}
