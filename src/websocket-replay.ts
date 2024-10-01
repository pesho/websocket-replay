#!/usr/bin/env node

import { Command, InvalidArgumentError } from "@commander-js/extra-typings";
import { WebSocketServer } from "ws";

const program = new Command()
    .name("websocket-replay")
    .description("Record and replay WebSocket messages")
    .version("0.0.0")
    .option("-p, --port <port>", "Port to listen on", parsePort, 8080)
    .configureHelp({ showGlobalOptions: true });

program
    .command("record <url> <filename>")
    .description("Proxy WebSocket to <url> and record messages to <filename>")
    .action((url, filename) => {
        const port = program.opts().port;
        console.log("Recording WebSocket messages to:", url, filename);
        const wss = new WebSocketServer({ port }, () => {
            console.log(`Websocket proxy server listening on http://localhost:${port}/`);
        });
        wss.on("connection", function connection(ws) {
            ws.on("error", console.error);

            ws.on("message", function message(data) {
                console.log("received: %s", data);
            });

            ws.send("something");
        });
    });

program
    .command("replay <filename>")
    .description("Replay WebSocket messages from <filename>")
    .option("-s, --speed <speed>", 'Replay speed. Use "max" for no delays.', parseSpeed, 1)
    .action((filename, options) => {
        const port = program.opts().port;
        const speedFactor = options.speed === "max" ? 0 : 1 / options.speed;
        console.log("Replaying WebSocket messages from:", filename);
        console.log("Speed factor:", speedFactor);
        const wss = new WebSocketServer({ port }, () => {
            console.log(`Websocket replay server listening on http://localhost:${port}/`);
        });
        wss.on("connection", function connection(ws) {
            ws.on("error", console.error);

            ws.on("message", function message(data) {
                console.log("received: %s", data);
            });

            ws.send("something");
        });
    });

program.parse();

function parsePort(x: string) {
    const port = parseInt(x);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new InvalidArgumentError("Invalid port.");
    }
    return port;
}

function parseSpeed(x: string) {
    if (x === "max") return "max";
    const speed = parseFloat(x);
    if (speed <= 0 || !Number.isFinite(speed)) {
        throw new InvalidArgumentError("Invalid speed.");
    }
    return speed;
}
