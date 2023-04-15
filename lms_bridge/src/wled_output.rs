use crate::types::WledOutputData;
use std::{io::Result, net::UdpSocket};

#[derive(Debug)]
pub struct WledOutput {
    host: String,
    port: u16,
    socket: Option<UdpSocket>,
}

impl WledOutput {
    pub fn new(configuration: &crate::types::WledOutputConfiguration) -> Self {
        return WledOutput {
            host: configuration.host.to_owned(),
            port: configuration.port,
            socket: UdpSocket::bind("0.0.0.0:0").ok(),
        };
    }

    pub fn on_data(self: &Self, data: &WledOutputData) -> Result<()> {
        let Some(ref socket) = self.socket else { return Ok(()); };
        socket.send_to(&data.data[..], format!("{}:{}", self.host, self.port))?;
        return Ok(());
    }
}
