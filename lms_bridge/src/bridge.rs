use std::collections::HashMap;

use crate::types;
use crate::{dmx_output::DmxOutput, types::WsMessage, wled_output::WledOutput};

#[derive(Debug)]
enum Output {
    Dmx(DmxOutput),
    Wled(WledOutput),
}

#[derive(Debug)]
pub struct Bridge {
    outputs: HashMap<String, Output>,
}

impl Bridge {
    pub fn new() -> Self {
        return Self {
            outputs: HashMap::new(),
        };
    }

    pub fn handle_message(self: &mut Self, msg: &WsMessage) {
        match msg {
            WsMessage::ConfigureOutputs { outputs } => self.configure_outputs(outputs),
            WsMessage::DmxData(data) => {
                todo!()
            }
        }
    }

    fn configure_outputs(self: &mut Self, configuration: &Vec<types::BaseOutput>) {
        self.outputs.clear();
        for outputConfiguration in configuration {
            let output = match &outputConfiguration.output {
                crate::types::Output::Dmx(c) => Output::Dmx(DmxOutput::new(&c)),
                crate::types::Output::Wled(c) => Output::Wled(WledOutput::new(&c)),
            };
            self.outputs.insert(outputConfiguration.id.to_owned(), output);
        }
    }
}
