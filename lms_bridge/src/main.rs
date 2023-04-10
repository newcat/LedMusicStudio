use std::thread;
use websocket::sync::Server;
use websocket::Message;

fn main() {
    let server = Server::bind("127.0.0.1:1234").unwrap();

    for connection in server.filter_map(Result::ok) {
        // Spawn a new thread for each connection.
        thread::spawn(move || {
            let mut client = connection.accept().unwrap();
            println!("Somebody connected");

            let message = Message::text("Hello, client!");
            let _ = client.send_message(&message);

            // ...
            client.shutdown().expect("Failed to close connection");
        });
    }
}
