// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { WledControllerConfiguration } from "./WledControllerConfiguration";
import type { WledControllerData } from "./WledControllerData";

export type WledControllerMessage = { type: "UpdateConfiguration" } & WledControllerConfiguration | { type: "Data" } & WledControllerData;