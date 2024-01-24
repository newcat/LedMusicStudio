use std::collections::HashMap;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::thread;

use crate::controllers::controller::{
    BridgeToControllerMessage, Controller, ControllerToBridgeMessage,
};
use crate::types::WsMessage;

pub struct Bridge {
    controller_to_bridge_rx: Receiver<ControllerToBridgeMessage>,
    controller_to_bridge_tx: Sender<ControllerToBridgeMessage>,
    controllers: HashMap<String, Sender<BridgeToControllerMessage>>,
}

impl Bridge {
    pub fn new() -> Self {
        let (tx, rx) = channel();
        return Self {
            controller_to_bridge_rx: rx,
            controller_to_bridge_tx: tx,
            controllers: HashMap::new(),
        };
    }

    pub fn handle_message(self: &mut Self, msg: &WsMessage) {
        println!("Received message: {:?}", msg);

        match msg {
            WsMessage::AddController {
                id,
                controller_type,
            } => {
                println!("Adding controller: {} (type {:?})", id, controller_type);
                let bridge_to_controller = channel();

                let mut controller = match controller_type {
                    crate::types::ControllerType::Wled => {
                        crate::controllers::wled_controller::WledController::new(
                            self.controller_to_bridge_tx.clone(),
                            bridge_to_controller.1,
                        )
                    }
                    crate::types::ControllerType::Dmx => {
                        panic!("DMX controller not implemented yet");
                    }
                };

                self.controllers
                    .insert(id.to_owned(), bridge_to_controller.0);

                let id_copy = id.to_owned();
                thread::spawn(move || {
                    controller.run();
                    println!("Controller {} exited", id_copy)
                });
            }
            WsMessage::RemoveController { id } => {
                println!("Removing controller: {}", id);
                if let Some(tx) = self.controllers.get(id) {
                    let _ = tx.send(BridgeToControllerMessage::Dispose);
                }
                self.controllers.remove(id);
            }
            WsMessage::CallController { id, message } => {
                println!("Calling controller: {} with message: {}", id, message);
                if let Some(tx) = self.controllers.get(id) {
                    let _ = tx.send(BridgeToControllerMessage::Message(message.to_owned()));
                }
            }
        }
    }
}
