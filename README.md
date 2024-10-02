# websocket-replay

Record and replay WebSocket messages

## Description

websocket-replay is a command-line tool that allows you to record WebSocket messages from a server and replay them later. This can be useful for testing, debugging, or simulating WebSocket interactions without connecting to a live server.

## Features

-   Record WebSocket messages to a file
-   Replay recorded WebSocket messages
-   Adjust replay speed
-   Option to wait for outgoing messages before replaying incoming ones

## Installation

To install websocket-replay, you need Node.js and npm installed on your system. Then run:

```
npm install -g websocket-replay
```

## Usage

websocket-replay provides two main commands: `record` and `replay`.

### Recording WebSocket Messages

To record messages from a WebSocket server:

```
websocket-replay record <url> <filename>
```

### Replaying WebSocket Messages

To replay recorded WebSocket messages:

```
websocket-replay replay <filename> [options]
```

-   `<filename>`: The file containing the recorded messages

Options:

-   `-s, --speed <speed>`: Replay speed. Use "max" for no delays. (default: 1)
-   `-n, --no-wait`: Don't wait for outgoing messages before replaying incoming ones
-   `-p, --port <port>`: Port to listen on (default: 8080)

Examples:

```
websocket-replay replay my-recording.tape
websocket-replay replay my-recording.tape --speed 2
websocket-replay replay my-recording.tape --speed max --no-wait
```
