#!/usr/bin/env node

import { Command } from "@commander-js/extra-typings";

const program = new Command()
    .name("websocket-replay")
    .description("Record and replay WebSocket messages")
    .version("0.0.0");

program
    .command("record <url> <filename>")
    .description("Proxy WebSocket to <url> and record messages to <filename>")
    .action((url: string, filename: string) => {
        console.log("Recording WebSocket messages to:", url, filename);
    });

program
    .command("replay <filename>")
    .description("Replay WebSocket messages from <filename>")
    .option("-s, --speed <speed>", 'Replay speed. Use "max" for no delays.', "1x")
    .action((filename: string, options) => {
        const speedFactor = options.speed === "max" ? 0 : 1 / parseFloat(options.speed);
        if (speedFactor < 0 || !Number.isFinite(speedFactor)) {
            program.error(`Invalid speed: ${options.speed}`);
        }
        console.log("Replaying WebSocket messages from:", filename);
        console.log("Options:", options);
        console.log("Speed factor:", speedFactor);
    });

program.parse();
