use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export)]
pub enum WsMessage {
    ConfigureOutputs { outputs: Vec<BaseOutputConfiguration> },
    DmxData(DmxOutputData),
    WledData(WledOutputData),
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export)]
pub enum OutputConfiguration {
    Dmx(DmxOutputConfiguration),
    Wled(WledOutputConfiguration),
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct BaseOutputConfiguration {
    pub id: String,
    pub output: OutputConfiguration,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DmxOutputConfiguration {
    pub port: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WledOutputConfiguration {
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