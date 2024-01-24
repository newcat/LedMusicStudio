use std::{
    fmt::Debug,
    sync::mpsc::{Receiver, Sender},
};

pub enum BridgeToControllerMessage {
    Message(String),
    Dispose,
}

pub struct ControllerToBridgeMessage {
    pub id: String,
    pub message: String,
}

pub trait Controller {
    fn new(tx: Sender<ControllerToBridgeMessage>, rx: Receiver<BridgeToControllerMessage>) -> Self
    where
        Self: Sized;
    fn run(&mut self) -> ();
}

impl Debug for dyn Controller {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        return write!(f, "Controller {{ ... }}");
    }
}
