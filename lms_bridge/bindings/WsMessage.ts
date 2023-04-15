// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { BaseOutput } from "./BaseOutput";
import type { DmxOutputData } from "./DmxOutputData";
import type { WledOutputData } from "./WledOutputData";

export type WsMessage = { type: "ConfigureOutputs", outputs: Array<BaseOutput>, } | { type: "DmxData" } & DmxOutputData | { type: "WledData" } & WledOutputData;