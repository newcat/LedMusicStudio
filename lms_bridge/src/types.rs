use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export)]
pub enum WsMessage {
    ConfigureOutputs { outputs: Vec<BaseOutput> },
    DmxData(DmxOutputData),
    WledData(WledOutputData),
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export)]
pub enum Output {
    Dmx(DmxOutput),
    Wled(WledOutput),
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct BaseOutput {
    pub id: String,
    pub output: Output,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DmxOutput {
    pub port: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WledOutput {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DmxOutputData {
    pub id: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WledOutputData {
    pub id: String,
    pub data: Vec<u8>,
}