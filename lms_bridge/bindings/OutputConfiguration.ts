// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { DmxOutputConfiguration } from "./DmxOutputConfiguration";
import type { WledOutputConfiguration } from "./WledOutputConfiguration";

export type OutputConfiguration = { type: "Dmx" } & DmxOutputConfiguration | { type: "Wled" } & WledOutputConfiguration;