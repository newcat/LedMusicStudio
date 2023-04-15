use std::fmt::Debug;

use crate::types::DmxOutputData;
use serialport::{SerialPort, Result};

pub struct DmxOutput {
    port_name: String,
    serialport: Option<Box<dyn SerialPort>>,
}

impl DmxOutput {
    pub fn new(configuration: &crate::types::DmxOutput) -> Self {
        let mut port = serialport::new(&configuration.port, 115200)
            .parity(serialport::Parity::None)
            .data_bits(serialport::DataBits::Eight)
            .stop_bits(serialport::StopBits::One)
            .open();

        if let Ok(ref mut p) = port {
            p.as_mut().write(&[99]);
        }

        return DmxOutput {
            port_name: configuration.port.to_owned(),
            serialport: port.ok(),
        };
    }

    pub fn on_data(self: &mut Self, data: &DmxOutputData) -> Result<()> {
        let Some(ref mut port) = self.serialport else { return Ok(()); };
        port.write(&data.data[..])?;
        return Ok(());
    }
}

impl Debug for DmxOutput {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DmxOutput")
            .field("port_name", &self.port_name)
            .finish()
    }
}
