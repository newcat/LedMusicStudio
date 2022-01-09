use wasm_bindgen::prelude::*;
mod utils;
pub mod particlenode;
mod colors;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
pub fn init() {
    utils::set_panic_hook();
    console_log!("WASM Initialized");
}
