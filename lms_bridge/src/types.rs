use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, TS, Clone, Copy)]
#[ts(export)]
pub enum ControllerType {
    WLED,
    DMX,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export)]
pub enum WsMessage {
    AddController {
        id: String,
        controller_type: ControllerType,
    },
    RemoveController {
        id: String,
    },
    CallController {
        id: String,
        message: String,
    },
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DmxOutputConfiguration {
    pub port: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DmxOutputData {
    pub id: String,
    pub data: Vec<u8>,
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct RenderedFile {
    #[serde(with = "serde_bytes")]
    #[ts(type = "Int8Array")]
    pub audio: Vec<u8>,
    pub timestamps: Vec<f64>,
    pub controllers: Vec<WsMessage>,
    pub commands: Vec<Vec<WsMessage>>,
}
