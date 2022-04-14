# @eove/his-node-client

Node.JS client to connect to an EOVE device exposing HIS features
[![node-client ci](https://github.com/eove/his-api/actions/workflows/node_client_ci.yml/badge.svg)](https://github.com/eove/his-api/actions/workflows/node_client_ci.yml)

## Installation

```
npm install @eove/his-node-client --save
```

## Usage

```js
const { createHisClient } = require('@eove/his-node-client');

const client = createHisClient(/*...*/);
client.on(ClientEventType.messageReceived, onMessageReceived);
client.connect().then(/*...*/).catch(/*...*/);
```

## Examples

There are some examples in `examples` directory.

You can run these examples from sources with following requirements:

```
git clone https://github.com/eove/his-api.git
cd node-client
nvm install # if you use nvm
npm install
```

For instance, to connect and watch server events (pings mostly):

```
npx ts-node examples/connect
```

Available examples are:

- `connect`: simple connection with ping/pong exchanges and get information result
- `list`: to print Android devices serial numbers
- `reset`: to reset usb stack on both sides (android and host) without unplugging cable
- `subscribeToAll`: to subscribe to all available channels
- `subscribeToWaveforms`: to subscribe to waveforms channel
- `subscribeToMonitorings`: to subscribe to monitorings channel
- `subscribeToSettings`: to subscribe to settings channel
- `subscribeToAlarms`: to subscribe to alarms channel
- `subscribeToVentilation`: to subscribe to ventilation channel

## Client events

HIS client is an event emitter and events are:

- `connected`: we are connected to device in accessory mode
- `disconnected`: we are disconnected from device
- `messageReceived`: we have received a message (with a type and a payload maybe)
- `messageSent`: we have sent a message (for debugging purpose)
- `error`: on any error detected

## Subscribing to channels

Available channels are:

- `waveforms`: to receive a batch of waveforms
- `monitorings`: to receive monitorings updates
- `settings`: to receive settings updates for current ventilation mode
- `alarms`: to receive alarms activations/deactivations
- `ventilation`: to receive ventilation related information and updates

## For contributors

### Publishing

Package is published on both public npm registry and Eove private one hosted by Github.

Warning: you must have a fake and empty `.git` directory in `node-client` directory.
There is a limitation in `npm version` script: https://github.com/npm/npm/issues/9111.

Just use `npm version` with something like `major` or specific version like `1.0.2`.
A commit/tag will be created and pushed on github then artifact will be published on npm registry.

Then you should publish the exact same version on Eove private registry with:

```
npm_config_registry=https://npm.pkg.github.com/eove npm publish
```
