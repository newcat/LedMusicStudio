use serde::{Deserialize, Serialize};
use std::{
    net::UdpSocket,
    sync::mpsc::{Receiver, Sender},
};
use ts_rs::TS;

use super::controller::{BridgeToControllerMessage, Controller, ControllerToBridgeMessage};

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WledControllerConfiguration {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WledControllerData {
    pub data: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export)]
pub enum WledControllerMessage {
    UpdateConfiguration(WledControllerConfiguration),
    Data(WledControllerData),
}

pub struct WledController {
    tx: Sender<ControllerToBridgeMessage>,
    rx: Receiver<BridgeToControllerMessage>,
    host: String,
    port: u16,
    socket: Option<UdpSocket>,
}

impl WledController {
    fn handle_message(self: &mut Self, msg: WledControllerMessage) {
        match msg {
            WledControllerMessage::UpdateConfiguration(configuration) => {
                println!("Updating configuration: {:?}", configuration);
                self.host = configuration.host;
                self.port = configuration.port;
            }
            WledControllerMessage::Data(data) => {
                let Some(ref socket) = self.socket else {
                    return;
                };
                socket
                    .send_to(&data.data[..], format!("{}:{}", self.host, self.port))
                    .unwrap();
            }
        }
    }
}

impl Controller for WledController {
    fn new(tx: Sender<ControllerToBridgeMessage>, rx: Receiver<BridgeToControllerMessage>) -> Self
    where
        Self: Sized,
    {
        return Self {
            tx,
            rx,
            host: String::new(),
            port: 0,
            socket: UdpSocket::bind("0.0.0.0:0").ok(),
        };
    }

    fn run(&mut self) -> () {
        loop {
            match self.rx.recv() {
                Ok(msg) => match msg {
                    BridgeToControllerMessage::Message(str_message) => {
                        let parsed_message: WledControllerMessage =
                            serde_json::from_str(&str_message).unwrap();
                        self.handle_message(parsed_message);
                    }
                    BridgeToControllerMessage::Dispose => {
                        break;
                    }
                },
                Err(err) => {
                    println!("Error receiving message: {}", err);
                    break;
                }
            }
        }
    }
}
