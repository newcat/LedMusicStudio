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

                self.controllers
                    .insert(id.to_owned(), bridge_to_controller.0);

                self.spawn_and_run_controller(
                    id.clone(),
                    bridge_to_controller.1,
                    controller_type.clone(),
                )
            }
            WsMessage::RemoveController { id } => {
                println!("Removing controller: {}", id);
                if let Some(tx) = self.controllers.get(id) {
                    let _ = tx.send(BridgeToControllerMessage::Dispose);
                } else {
                    println!("Controller {} not found", id);
                }
                self.controllers.remove(id);
            }
            WsMessage::CallController { id, message } => {
                println!("Calling controller: {} with message: {}", id, message);
                if let Some(tx) = self.controllers.get(id) {
                    let _ = tx.send(BridgeToControllerMessage::Message(message.to_owned()));
                } else {
                    println!("Controller {} not found", id);
                }
            }
        }
    }

    fn spawn_and_run_controller(
        self: &Self,
        id: String,
        btc: Receiver<BridgeToControllerMessage>,
        controller_type: crate::types::ControllerType,
    ) {
        let ctb = self.controller_to_bridge_tx.clone();
        thread::spawn(move || {
            let mut controller: Box<dyn Controller> = match controller_type {
                crate::types::ControllerType::WLED => Box::new(
                    crate::controllers::wled_controller::WledController::new(ctb, btc),
                ),
                crate::types::ControllerType::DMX => Box::new(
                    crate::controllers::dmx_controller::DmxController::new(ctb, btc),
                ),
            };
            controller.run();
            println!("Controller {} exited", id)
        });
    }
}
