mod bridge;
mod dmx_output;
mod types;
mod wled_output;

use std::net::TcpStream;
use types::WsMessage;
use websocket::sync::{Client, Server};
use websocket::OwnedMessage;

use crate::bridge::Bridge;

fn on_connect(mut client: Client<TcpStream>) {
    println!("Client connected");
    let mut bridge = Bridge::new();
    for raw_msg in client.incoming_messages().filter_map(Result::ok) {
        match raw_msg {
            OwnedMessage::Text(s) => {
                let msg: WsMessage = serde_json::from_str(&s).unwrap();
                bridge.handle_message(&msg);
            }
            OwnedMessage::Close(_) => {
                println!("Client disconnected");
                return;
            }
            _ => println!("Unsupported message type: {:?}", raw_msg),
        }
    }
}

fn main() {
    let mut server = Server::bind("127.0.0.1:1234").unwrap();
    println!("LMSBridge started. Listening on port 1234...");

    loop {
        match server.accept() {
            Ok(wsupgrade) => {
                println!("Client connecting");
                if let Ok(client) = wsupgrade.accept() {
                    on_connect(client);
                } else {
                    println!("Client failed to connect");
                }
            }
            _ => {
                // Nobody tried to connect, move on.
            }
        };
    }
}
