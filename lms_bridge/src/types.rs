use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
pub enum WsMessage {
    ConfigureOutputs { outputs: Vec<BaseOutput> },
    DmxData(DmxOutputData),
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
pub enum Output {
    Dmx(DmxOutput),
    Wled(WledOutput),
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct BaseOutput {
    pub id: String,
    pub output: Output,
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct DmxOutput {
    pub port: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct WledOutput {
    pub host: String,
    pub port: u16,
    pub timeout: usize,
    pub num_leds: usize,
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct DmxOutputData {
    pub id: String,
    pub data: Vec<u8>,
}
