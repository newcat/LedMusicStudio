
#[derive(Debug)]
pub struct WledOutput {
    host: String,
    port: u16,
    timeout: usize,
    num_leds: usize,
}

impl WledOutput {
    pub fn new(configuration: &crate::types::WledOutput) -> Self {
        return WledOutput {
            host: configuration.host.to_owned(),
            port: configuration.port,
            num_leds: configuration.num_leds,
            timeout: configuration.timeout,
        };
    }
}
