#!/usr/bin/env node

import { Command, InvalidArgumentError } from "@commander-js/extra-typings";

const program = new Command()
    .name("websocket-replay")
    .description("Record and replay WebSocket messages")
    .version("0.0.0")
    .option("-p, --port <port>", "Port to listen on", parsePort, 8080)
    .configureHelp({ showGlobalOptions: true });

program
    .command("record <url> <filename>")
    .description("Proxy WebSocket to <url> and record messages to <filename>")
    .action((url: string, filename: string) => {
        console.log("Recording WebSocket messages to:", url, filename);
    });

program
    .command("replay <filename>")
    .description("Replay WebSocket messages from <filename>")
    .option("-s, --speed <speed>", 'Replay speed. Use "max" for no delays.', parseSpeed, 1)
    .action((filename: string, options) => {
        const port = program.opts().port;
        const speedFactor = options.speed;
        console.log("Replaying WebSocket messages from:", filename);
        console.log("Options:", options);
        console.log("Port:", port);
        console.log("Speed factor:", speedFactor);
    });

program.parse();

function parsePort(x: string): number {
    const port = parseInt(x);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new InvalidArgumentError(`Invalid port: ${x}`);
    }
    return port;
}

function parseSpeed(x: string): number {
    if (x === "max") return 0;
    const speedFactor = 1 / parseFloat(x);
    if (speedFactor < 0 || !Number.isFinite(speedFactor)) {
        throw new InvalidArgumentError(`Invalid speed: ${x}`);
    }
    return speedFactor;
}
