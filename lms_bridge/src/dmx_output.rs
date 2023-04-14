
#[derive(Debug)]
pub struct DmxOutput {
    port: String,
}

impl DmxOutput {
    pub fn new(configuration: &crate::types::DmxOutput) -> Self {
        return DmxOutput {
            port: configuration.port.to_owned(),
        };
    }
}
