import { isReactive } from "vue";
import * as Comlink from "comlink";

const vueReactiveTransferHandler: Comlink.TransferHandler<any, any> = {
    canHandle: ((x: any) => {
        return (
            !(x instanceof Float32Array) && (isReactive(x) || (x && typeof x === "object" && Object.values(x).some((v) => isReactive(v))))
        );
    }) as (x: any) => x is any,
    serialize: (x) => [JSON.parse(JSON.stringify(x)), []],
    deserialize: (x) => x,
};
Comlink.transferHandlers.set("VueReactiveValue", vueReactiveTransferHandler);
