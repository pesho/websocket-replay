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
            // delete headers["sec-websocket-extensions"];
            delete headers["sec-websocket-protocol"];
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
    .option("-n, --no-wait", "Don't count outgoing messages before replaying incoming ones")
    .action((filename, options) => {
        const port = program.opts().port;
        const speedFactor = options.speed === "max" ? 0 : 1 / options.speed;
        const wait = options.wait;
        console.log("Replaying WebSocket messages from:", filename);
        console.log("Speed factor:", speedFactor);
        const wss = new WebSocketServer({ port }, () => {
            console.log(`Websocket replay server listening on http://localhost:${port}/`);
        });
        wss.on("connection", async function connection(wsServer) {
            const startTime = Date.now();
            const connFilename = getConnFilename(filename);
            let outgoingCount: number = 0;
            let readCount: number = 0;

            console.log("New connection accepted. Replaying from:", connFilename);
            const file = await fs.open(connFilename, "r");
            const sendBuffer: [number, string][] = [];

            wsServer.on("error", console.error);

            wsServer.on("message", function message() {
                ++outgoingCount;
                checkSend();
            });

            wsServer.on("close", function close() {
                console.log("Connection closed. Replaying complete:", connFilename);
                file.close();
            });

            function checkSend() {
                while (sendBuffer.length > 0) {
                    const [count, data] = sendBuffer[0];
                    if (wait && outgoingCount < count) break;
                    sendBuffer.shift();
                    wsServer.send(data);
                }
            }

            for await (const line of file.readLines()) {
                const record = JSON.parse(line) as Message;
                const time = record[0] * speedFactor;
                if (record[1] === "incoming") {
                    const data = record[2];
                    await sleepUntil(startTime + time);
                    if (wsServer.readyState === WebSocket.CLOSED) break;
                    sendBuffer.push([readCount, data]);
                    checkSend();
                } else if (record[1] === "outgoing") {
                    ++readCount;
                }
            }
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

function sleepFor(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sleepUntil(time: number) {
    const now = Date.now();
    const ms = time > now ? time - now : 0;
    return sleepFor(ms);
}

type IncomingMessage = [number, "incoming", string];
type OutgoingMessage = [number, "outgoing", string];
// type OutgoingMessage = [number, "outgoing"];
type Message = IncomingMessage | OutgoingMessage;
