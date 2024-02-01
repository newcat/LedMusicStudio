use serde::{Deserialize, Serialize};
use serialport::SerialPort;
use std::sync::mpsc::{Receiver, Sender};
use ts_rs::TS;

use super::controller::{BridgeToControllerMessage, Controller, ControllerToBridgeMessage};

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DmxControllerConfiguration {
    pub port: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DmxControllerData {
    pub data: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export)]
pub enum DmxControllerMessage {
    UpdateConfiguration(DmxControllerConfiguration),
    Data(DmxControllerData),
}

pub struct DmxController {
    tx: Sender<ControllerToBridgeMessage>,
    rx: Receiver<BridgeToControllerMessage>,
    serialport: Option<Box<dyn SerialPort>>,
}

impl DmxController {
    fn handle_message(self: &mut Self, msg: DmxControllerMessage) {
        match msg {
            DmxControllerMessage::UpdateConfiguration(configuration) => {
                println!("Updating configuration: {:?}", configuration);

                let mut port = serialport::new(&configuration.port, 115200)
                    .parity(serialport::Parity::None)
                    .data_bits(serialport::DataBits::Eight)
                    .stop_bits(serialport::StopBits::One)
                    .open();

                match port {
                    Ok(ref mut p) => {
                        let _ = p.as_mut().write(&[99]);
                    }
                    Err(ref err) => {
                        println!("Failed to open port {}: {}", configuration.port, err);
                    }
                }
            }
            DmxControllerMessage::Data(data) => {
                println!("Sending data: {:?}", data);
                if let Some(ref mut port) = self.serialport {
                    let _ = port.write(&data.data[..]);
                };
            }
        }
    }
}

impl Controller for DmxController {
    fn new(tx: Sender<ControllerToBridgeMessage>, rx: Receiver<BridgeToControllerMessage>) -> Self
    where
        Self: Sized,
    {
        return Self {
            tx,
            rx,
            serialport: None,
        };
    }

    fn run(&mut self) -> () {
        loop {
            match self.rx.recv() {
                Ok(msg) => match msg {
                    BridgeToControllerMessage::Message(str_message) => {
                        println!("Received message: {}", str_message);
                        let parsed_message: DmxControllerMessage =
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
