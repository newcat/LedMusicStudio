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
                let Some(output) = self.outputs.get_mut(&data.id) else {
                    println!("Could not find output with id {}", data.id);
                    return;
                };
                let Output::Dmx(dmx_output) = output else {
                    println!("Output {} is not of type DMX", data.id);
                    return;
                };
                if dmx_output.on_data(data).is_err() {
                    println!("Failed to write to serialport");
                }
            },
            WsMessage::WledData(data) => {
                let Some(output) = self.outputs.get_mut(&data.id) else {
                    println!("Could not find output with id {}", data.id);
                    return;
                };
                let Output::Wled(wled_output) = output else {
                    println!("Output {} is not of type WLED", data.id);
                    return;
                };
                if wled_output.on_data(data).is_err() {
                    println!("Failed to send UDP packet to WLED controller");
                }
            }
        }
    }

    fn configure_outputs(self: &mut Self, configuration: &Vec<types::BaseOutputConfiguration>) {
        self.outputs.clear();
        for output_configuration in configuration {
            let output = match &output_configuration.output {
                crate::types::OutputConfiguration::Dmx(c) => Output::Dmx(DmxOutput::new(&c)),
                crate::types::OutputConfiguration::Wled(c) => Output::Wled(WledOutput::new(&c)),
            };
            self.outputs
                .insert(output_configuration.id.to_owned(), output);
        }
    }
}
