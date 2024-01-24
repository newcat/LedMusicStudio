mod bridge;
mod controllers;
mod dmx_output;
mod types;

use std::net::TcpListener;
use tungstenite::{accept, Error as WsError};
use types::WsMessage;

use crate::bridge::Bridge;

fn main() {
    let server = TcpListener::bind("127.0.0.1:1234").unwrap();
    println!("LMSBridge started. Listening on port 1234...");

    for stream in server.incoming() {
        let mut websocket = accept(stream.unwrap()).unwrap();
        println!("Client connected");
        let mut bridge = Bridge::new();
        loop {
            let msg = websocket.read();
            match msg {
                Ok(msg) => match msg {
                    tungstenite::Message::Text(s) => {
                        let msg: WsMessage = serde_json::from_str(&s).unwrap();
                        bridge.handle_message(&msg);
                    }
                    _ => (),
                },
                Err(WsError::ConnectionClosed) => {
                    println!("Client disconnected");
                    break;
                }
                Err(e) => {
                    println!("Error reading message: {:?}", e);
                }
            };
        }
    }
}
