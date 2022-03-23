# @eove/his-node-client

Node.JS client to connect to an Eove device exposing HIS features

## Installation

```
npm install @eove/his-node-client --save
```

## Usage

```js
const { createHisClient } = require('@eove/his-node-client');

const client = createHisClient(/*...*/);
client.on(ClientEventType.message, onMessage);
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
- `message`: we have received a message (with a type and a payload maybe)
- `error`: on any error detected

## Subscribing to channels

Available channels are:

- `waveforms`: to receive a batch of waveforms
- `monitorings`: to receive monitorings updates
- `settings`: to receive settings updates for current ventilation mode
- `alarms`: to receive alarms activations/deactivations
- `ventilation`: to receive ventilation related information and updates
