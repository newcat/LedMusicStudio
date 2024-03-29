mod bridge;
mod controllers;
mod types;

use clap::{Parser, Subcommand};
use flate2::read::GzDecoder;
use rodio::{Decoder, OutputStream, Sink};
use serde::Deserialize;
use std::{io::Cursor, net::TcpListener};
use tungstenite::{accept, Error as WsError};
use types::WsMessage;

use crate::bridge::Bridge;

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    Play {
        file: String,
        #[arg(short, long, default_value_t = 1.0)]
        volume: f32,
    },
    Bridge {
        #[arg(short, long)]
        port: Option<u16>,
    },
}

/*struct FixtureState {
    id: String,
    r#type: ControllerType,
    value: V,
    config: C,
}*/

#[derive(Deserialize)]
struct RenderedFile {
    #[serde(with = "serde_bytes")]
    audio: Vec<u8>,
    timestamps: Vec<f64>,
    /*fixtures: FixtureState[];
    fixtureValues: Record<string, unknown[]>;*/
}

fn play_rendered(file: &str, volume: f32) {
    println!("Playing rendered file {}", file);
    let file = std::fs::File::open(file).unwrap();
    let gzip_decoder = GzDecoder::new(file);
    let rendered_file: RenderedFile = rmp_serde::from_read(gzip_decoder).unwrap();
    println!("Audio length: {:?}", rendered_file.audio.len());

    let (_stream, stream_handle) = OutputStream::try_default().unwrap();
    let sink = Sink::try_new(&stream_handle).unwrap();
    let source = Decoder::new_mp3(Cursor::new(rendered_file.audio)).unwrap();
    sink.append(source);
    sink.set_volume(volume);
    sink.sleep_until_end();
}

fn start_bridge(port: u16) {
    let server = TcpListener::bind(("127.0.0.1", port)).unwrap();
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
                    break;
                }
            };
        }
    }
}

fn main() {
    let args = Cli::parse();
    match args.command {
        Some(Commands::Play { file, volume }) => play_rendered(&file, volume),
        Some(Commands::Bridge { port }) => start_bridge(port.unwrap_or(1234)),
        None => println!("No command provided"),
    }
}
