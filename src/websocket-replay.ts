#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { Command, InvalidArgumentError } from "@commander-js/extra-typings";
import WebSocket, { WebSocketServer } from "ws";

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
        console.log("Recording WebSocket messages to:", url);
        const wss = new WebSocketServer({ port }, () => {
            console.log(`Websocket proxy server listening on http://localhost:${port}/`);
        });
        wss.on("connection", async function connection(wsServer, req) {
            const startTime = Date.now();
            const connFilename = getConnFilename(filename);

            console.log("New connection accepted. Recording to:", connFilename);

            const file = await fs.open(connFilename, "w");
            const sendBuffer: WebSocket.RawData[] = [];

            const protocol = req.headers["sec-websocket-protocol"];
            const headers = { ...req.headers };
            delete headers["sec-websocket-protocol"];
            delete headers["sec-websocket-extensions"];
            delete headers["sec-websocket-key"];
            delete headers["sec-websocket-version"];
            delete headers["upgrade"];
            delete headers["connection"];
            delete headers["host"];

            const wsClient = new WebSocket(url, protocol, { headers });

            wsClient.on("error", console.error);

            wsClient.on("open", function open() {
                for (const data of sendBuffer) {
                    wsClient.send(data);
                }
                sendBuffer.length = 0;
            });

            wsClient.on("message", function message(data) {
                const time = Date.now() - startTime;
                const record: IncomingMessage = [time, "incoming", data.toString()];
                file.appendFile(JSON.stringify(record) + "\n");
                wsServer.send(data);
            });

            wsClient.on("close", function close() {
                wsServer.terminate();
            });

            wsServer.on("error", console.error);

            wsServer.on("message", function message(data) {
                const time = Date.now() - startTime;
                // const record: OutgoingMessage = [time, "outgoing"];
                const record: OutgoingMessage = [time, "outgoing", data.toString()];
                file.appendFile(JSON.stringify(record) + "\n");
                if (wsClient.readyState === WebSocket.OPEN) {
                    wsClient.send(data);
                } else {
                    sendBuffer.push(data);
                }
            });

            wsServer.on("close", function close() {
                console.log("Connection closed. Recording complete:", connFilename);
                wsClient.terminate();
                file.close();
            });
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
        wss.on("connection", function connection(wsServer) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const connFilename = getConnFilename(filename);

            wsServer.on("error", console.error);

            wsServer.on("message", function message(data) {
                console.log("received: %s", data);
            });

            wsServer.send("something");
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

let connectionCount = 0;

/**
 * Generates a unique filename for each WebSocket client connection.
 *
 * @param {string} filename - The base filename to use.
 * @returns {string} A unique filename. For the first connection, it returns the original filename.
 *                   For subsequent connections, it appends a counter to the filename.
 */
function getConnFilename(filename: string) {
    if (connectionCount++ === 0) return filename;
    const parsed = path.parse(filename);
    return path.format({ ...parsed, base: undefined, name: parsed.name + "." + connectionCount });
}

type IncomingMessage = [number, "incoming", string];
type OutgoingMessage = [number, "outgoing", string];
// type OutgoingMessage = [number, "outgoing"];
// type Message = IncomingMessage | OutgoingMessage;
