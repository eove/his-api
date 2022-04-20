# EOVE HIS interface

## Foreword

To ease the monitoring of several devices in a hospital environment, a way to collect and gather each device data is required.
The goal is to provide a dashboard to nurses, and avoid the need to physically move to patients room to check ventilation status.
As a ventilation device manufacturer, EOVE provides an interface on its devices to export live data.
It does not deal with the display of these data to nurses.

> **WARNING**: The software using the eo150 ventilation data must be developed and validated by applying medical devices standards for its intended use.
> Eove does not assume responsibility for the use of the data.

## Hardware setup

The function is available for EOVE-150 products running at least EOVE-150 application version:

- `>= 3.2.0` for `3.x` versions
- `>= 2.6.0` for `2.x` versions

It uses a wired connection which requires a USB 2.0 cable with a micro USB plug.

```
      Computer
   running HIS client
     +---------+
     | [     ] |                            EOVE-150 ventilator
     | [     ] |                            running HIS server
     |         |                            +----------------+
     |      o  |                            | +------------+ |
     |         |                            | |            | |
     |         |                            | |            | |
     |         | USB-A            micro USB | |            | |
     |         +----------------------------+ +------------+ |
     +---------+        USB cable           +----------------+
```

An EOVE-150 product is made of two components: a ventilation module and a docking station running Android OS.
This means the data from the ventilation module will only be available if:

- the ventilation module is turned ON
- the ventilation module is inserted in the docking station

## Software setup

The EOVE-150 station is put in USB accessory mode and delivers data to an accessory acting as USB host.

### Link level

The link protocol is Android Open Accessory as described in https://source.android.com/devices/accessories/protocol.

The EOVE-150 station is put in USB accessory mode and delivers data to an accessory acting as USB host.

### Application level

The EOVE-150 application acts as a server that responds to client sollicitations when HIS connectivity is enabled.

To enable HIS connectivity on EOVE-150 user interface:

- open drawer menu
- press unlock button at the bottom
- press on maintenance menu entry
- press on connectivity tab
- in HIS section toggle Enable connectivity item

## Reference implementation

EOVE provides a reference implementation that includes a Node.JS client (see https://github.com/eove/his-API/tree/master/node-client).

This client is able to perform all the steps needed in order to retrieve live data from a running ventialtion device.

The main steps a client must perform are:

- trigger the accessory mode on the EO150 station
- write message to start a high level communication
- write message in order to subscribe to channels
- read data from EO150 station
- respond to EO150 station pings to keep the link alive

## Data format

Data exchanged over USB link are JSON strings separated by a new line character and encoded in UTF-8 bytes.

Example of such string before UTF-8 encoding:

```
{"type":"DO_SOMETHING"}\n
```

Client can either send or receive such messages.

### API descriptors

JSON data may include some constants like `MON_VTI_u` and some values like `303`.
We do not include any description or units at runtime as we want to provide a compact API.
In exchange, we provide static API descriptors (see https://github.com/eove/his-api/tree/master/docs/descriptors).
These descriptors include information like monitorings or settings with units and english descriptions for each constant.

Here is an extract:

```json
{
  "monitorings": {
    "MON_VTI_u": {
      "label": "VTI",
      "unit": "UNIT_ML"
    }
  },
  "units": {
    "UNIT_ML": {
      "label": "mL"
    }
  }
}
```

Given the descriptor `hisapi_v0.9.0-32.2_eo150_en-EN.json` (see https://github.com/eove/his-api/tree/master/docs/descriptors/hisapi_v0.9.0-32.2_eo150_en-EN.json) client can read `MON_VTI_u` description which is actually "VTI" monitoring and unit is "UNIT_ML" which corresponds to "mL".

A descriptor filename is composed of `hisapi_v<his api version>-<module api version>_<product type>_<locale>.json`.
Most of these information can be retrieved with [GET_INFORMATION message](#get_information-message) and its `GET_INFORMATION_SUCCEEDED` response.

Here is an extract:

```json
{
  "type": "GET_INFORMATION_SUCCEEDED",
  "payload": {
    "apiVersion": "0.9.0",
    "product": { "type": "eo150" },
    "module": {
      "apiVersion": "32.2"
    }
  }
}
```

## Plumbing

### Accessory mode

As a prerequisite, USB cable must be plugged on micro USB port.

Trigger Accessory Mode according to https://source.android.com/devices/accessories/aoa.

Reference implementation is located in `accessoryModeConfigurator.ts` (see https://github.com/eove/his-API/blob/master/node-client/lib/usb/accessoryModeConfigurator.ts).

In summary steps are:

- find Android device based on usual Android USB ids
- send a control transfer in request to validate version code
- send multiple control transfer out requests with accessory information
- send a control transfer out request to put Android device in accessory mode

Note that an Android device stays in accessory mode, there is no command to put it in default mode back.

The device leaves this mode automatically when:

- USB cable is unplugged
- USB is reset on accessory side
- Android device reboots

Also note that only one accessory can be connected to an Android device.
This means you cannot connect two clients to the same server.

### Communication ping/pong mechanism

To keep the connection alive, pings are emitted periodicaly by the server (typically every 8s).
The client shall reply with special [pongs messages](#pong-message) before the timeout (typically 5s).

Client reads:

```json
{
  "type": "PING"
}
```

Client writes:

```json
{
  "type": "PONG"
}
```

When client fails to send a pong message, server will consider client as disconnected.
This means that client will have to start [high level communication](#high-level-communication) again.

### Data format

When decoded and delimited, messages are JSON-valid strings.
In other words every used types are compatible with JSON (number, string, array, etc.).

Dates (with time component) are converted to epoch with a millisecond precision.

## Client messages

Client can send message to server and these messages are mostly commands.
This means message type will be an order like `DO_SOMETHING` or `GET_ME_SOMETHING`.

Command messages will often receive a positive response message like `DO_SOMETHING_SUCCEEDED`.

`DO_SOMETHING` or `GET_ME_SOMETHING` are not valid messages but are used in several examples because they are concise enough.

A message has the following simplified type:

```ts
interface Message {
  type: string;
  reference?: string;
  payload?: any;
}
```

### High level communication

By default server will ignore any message coming from client because high level communication is not considered as started.
Client should send a [START_COMMUNICATION](#start_communication-message) message to start it.

### Using a reference

An optional `reference` field is available to help the client link messages and replies.
The server returns the `reference` field provided unchanged in its replies.

Client writes:

```json
{
  "type": "GET_SOMETHING",
  "reference": "1"
}
```

As a response, client reads:

```json
{
  "type": "GET_SOMETHING_SUCCEEDED",
  "reference": "1"
}
```

### START_COMMUNICATION message

This message must be the first one because it starts high level communication with server.
If client is able to send such message and receive a positive response it basically validates the bidirectional communication.

Client writes:

```json
{
  "type": "START_COMMUNICATION"
}
```

Client reads:

```json
{
  "type": "START_COMMUNICATION_SUCCEEDED",
  "payload": {
    "apiVersion": "1.0.0"
  }
}
```

The succeeded response includes the HIS server API version.

### STOP_COMMUNICATION message

This message will properly stop high level communication with server.

Client writes:

```json
{
  "type": "STOP_COMMUNICATION"
}
```

Client reads:

```json
{
  "type": "STOP_COMMUNICATION_SUCCEEDED"
}
```

No other message will be processed by server except another start communication one.

### PONG message

Client writes:

```json
{
  "type": "PONG"
}
```

This message won't receive a corresponding response but another ping message will follow.

### SUBSCRIBE message

Client can subscribe to various channels to receive data in real time.

Example for a waveforms and monitorings subscription:

```json
{
  "type": "SUBSCRIBE",
  "payload": ["waveforms", "monitorings"]
}
```

Upon success, client receives:

```json
{
  "type": "SUBSCRIBE_SUCCEEDED"
}
```

When client subscribes with multiple messages he or she will be subscribed to all provided channels without any duplications.
In other word client may subscribe to `waveforms` and then `waveforms` plus `monitorings`, he will receive waveforms messages only once.

### UNSUBSCRIBE message

Example for a waveforms unsubscription:

```json
{
  "type": "UNSUBSCRIBE",
  "payload": ["waveforms"]
}
```

Upon success, client receives:

```json
{
  "type": "UNSUBSCRIBE_SUCCEEDED"
}
```

Client might subscribe to a given channel multiple times but when he or she unsubscribes from it, he or she will be totally unsubscribed.

### GET_INFORMATION message

Client sends:

```json
{
  "type": "GET_INFORMATION"
}
```

Client reads:

```json
{
  "type": "GET_INFORMATION_SUCCEEDED",
  "payload": {
    "apiVersion": "0.9.0",
    "product": { "type": "eo150" },
    "module": {
      "type": "vm150",
      "serialNumber": "EO1500617140",
      "apiVersion": "32.2",
      "cpuVersion": "C150000702",
      "powerVersion": "P150000400",
      "gaugeVersion": "5",
      "batteryType": "EOVE1"
    },
    "station": {
      "type": "eodisplay",
      "serialNumber": "ee803ca3071839d4",
      "applicationVersion": "3.2.0-dev.3",
      "systemVersion": "eove-eodisplay-2.2.1",
      "bootloaderVersion": "2017.12.0-EOVE_v1.2.2-g598a8e923"
    }
  }
}
```

Such payload can be read as follows:

> You are connected to an USB device with serial number ee803ca3071839d4 which appear to be an EOVE-150 product with a compatible ventilation module inserted into its station.

Note: ventilation module data are available only if the ventilation module is turned ON and inserted in the docking station.

## Channel subscription

The ventilation data are provided in near real time through subscription to channels.

The client sends `SUBSCRIBE` or `UNSUBSCRIBE` messages for one or multiple channels.

Available channels are:

- [waveforms](#waveforms-channel): to receive a batch of waveforms
- [monitorings](#monitorings-channel): to receive monitorings updates
- [settings](#settings-channel): to receive settings updates for current ventilation mode
- [alarms](#alarms-channel): to receive alarms activations/deactivations
- [ventilation](#ventilation-channel): to receive ventilation related information and updates

The response to a subscription is typically an initial snapshot, followed by incremental patches to update the data.

When ventilaton module reconnects a snapshot is usually sent before any patch.
Client can then replace all the state he or she has built so far by this new snapshot.

### Waveforms channel

Subscription example:

```json
{
  "type": "SUBSCRIBE",
  "payload": ["waveforms"]
}
```

#### WAVEFORMS message

Waveforms can be built from a stream of samples that contain timestamp, pressure, flow, and volume.

A sample is a table with this format: `[number (epoch ms), number (pressure), number (flow), number (volume)]`.

For compacity and performance, samples are grouped in 12-sample chunks such as:

```json
{
  "type": "WAVEFORMS",
  "payload": [
    [1646909463640, 19.6, 26.7, 357],
    [1646909463680, 19.8, 26.7, 375],
    [1646909463720, 19.6, 26.7, 393],
    [1646909463760, 19.6, 26.7, 411],
    [1646909463800, 19.6, 26.7, 429],
    [1646909463840, 19.5, 26.7, 447],
    [1646909463880, 19.6, 26.7, 465],
    [1646909463920, 19.5, 26.7, 483],
    [1646909463960, 19.7, 26.7, 501],
    [1646909463990, 19.5, 26.7, 519],
    [1646909464040, 19.7, 26.7, 537],
    [1646909464080, 19.7, 26.7, 555]
  ]
}
```

A sample is taken every 80 ms (or 40 ms for newborn patients) by the ventilation module, which results in 12-samples chunks emitted every 960 ms (or 480 ms for newborn patients) from the station.

Waveforms have no snapshot/patch distinction because we send all components every time (pressure, flow, etc.).

#### WAVEFORMS_UNAVAILABLE message

Such message is sent when waveforms cannot be read due to a missing ventilation module.

Client receives:

```json
{
  "type": "WAVEFORMS_UNAVAILABLE"
}
```

### Monitorings channel

#### Subscription

Example:

```json
{
  "type": "SUBSCRIBE",
  "payload": ["monitorings"]
}
```

#### MONITORINGS_SNAPSHOT message

At first, all data are new, so the first message contains all values.

First message:

```json
{
  "type": "MONITORINGS_SNAPSHOT",
  "payload": {
    "epochMs": 1647253069930,
    "MON_PIP_u": 10.6,
    "MON_PEEP_u": 3.9,
    "MON_VTI_u": 303,
    "MON_VTE_u": null,
    "MON_RATE_u": 30,
    "MON_I_E_NUM_u": 1,
    "MON_LEAK_u": 0,
    "MON_SPO2_u": null,
    "MON_VM_u": 9,
    "MON_I_TIME_u": 1,
    "MON_E_TIME_u": 1,
    "MON_HR_u": null,
    "MON_FLOW_MAX_u": 19.1,
    "MON_FLOW_MIN_u": 0,
    "MON_FIO2_u": null,
    "MON_ETCO2_u": null
  }
}
```

Most values are numbers or `null` (e.g. when sensor is unavailable or ventilation is stopped).

#### MONITORINGS_PATCH message

After a snapshot, further messages will only hold updates.

Second message, with only one value to be updated:

```json
{
  "type": "MONITORINGS_PATCH",
  "payload": { "epochMs": 1647253070930, "MON_PIP_u": 11.9 }
}
```

Third message, with three values updates

```json
{
  "type": "MONITORINGS_PATCH",
  "payload": {
    "epochMs": 1647253072930,
    "MON_PIP_u": 16.2,
    "MON_VTI_u": 301,
    "MON_FLOW_MAX_u": 19
  }
}
```

#### MONITORINGS_UNAVAILABLE message

Such message is sent when monitorings cannot be read due to a missing ventilation module.

Client receives:

```json
{
  "type": "MONITORINGS_UNAVAILABLE"
}
```

### Settings channel

Subscription example:

```json
{
  "type": "SUBSCRIBE",
  "payload": ["settings"]
}
```

#### SETTINGS_SNAPSHOT message

Example of initial snapshot message:

```json
{
  "type": "SETTINGS_SNAPSHOT",
  "payload": {
    "mode": "SET_VAC",
    "circuitType": "VALVE",
    "patientType": "PEDIATRIC",
    "newborn": true,
    "settings": {
      "SET_VAC_Vol": 95,
      "SET_VAC_Peep": 4,
      "SET_VAC_Flow_Ramp": 1,
      "SET_VAC_Rate": 30,
      "SET_VAC_I_Time": 0.7,
      "SET_VAC_I_Trig": "AUTO",
      "SET_VAC_Sigh": "OFF"
    },
    "alarmSettings": {
      "SET_VAC_ALARM_P_Min": 10,
      "SET_VAC_ALARM_P_Max": 20,
      "SET_VAC_ALARM_Vte_Min": "OFF",
      "SET_VAC_ALARM_Vte_Max": "OFF",
      "SET_VAC_ALARM_Rate_Max": "OFF",
      "SET_VAC_ALARM_FIO2_Min": "OFF",
      "SET_VAC_ALARM_FIO2_Max": "OFF",
      "SET_VAC_ALARM_SPO2_Min": "OFF",
      "SET_VAC_ALARM_Disconnection_Timer": "AUTO"
    }
  }
}
```

Snapshot/patch payloads include `newborn` boolean information when patient type is pediatric.
When patient type becomes adult, `newborn` information is set to `UNAVAILABLE` in patch's payload.

Generally speaking any information missing from previous state in current state is set to `UNAVAILABLE` in patch's payload.
This is a way to represent the absence of information in a incremental update.

Settings or alarm settings are numbers or `AUTO` or `OFF`.

#### SETTINGS_PATCH message

Example:

```json
{
  "type": "SETTINGS_PATCH",
  "payload": {
    "epochMs": 1647363859520,
    "settings": {
      "SET_VAC_Vol": 90
    }
  }
}
```

#### SETTINGS_UNAVAILABLE message

Such message is sent when settings cannot be read due to a missing ventilation module.

Client receives:

```json
{
  "type": "SETTINGS_UNAVAILABLE"
}
```

### Ventilation channel

Subscription example:

```json
{
  "type": "SUBSCRIBE",
  "payload": ["ventilation"]
}
```

#### VENTILATION_STATE message

Right after subscription client receives the ventilation state with current mode and if ventilation is started or not.

```json
{
  "type": "VENTILATION_STATE",
  "payload": { "mode": "SET_AI", "started": true }
}
```

#### VENTILATION_STARTED message

As soon as ventilation is started client will receive the following message:

```json
{
  "type": "VENTILATION_STARTED",
  "payload": { "epochMs": 1647254196170 }
}
```

#### VENTILATION_STOPPED message

As soon as ventilation is stopped client will receive the following message:

```json
{
  "type": "VENTILATION_STOPPED",
  "payload": { "epochMs": 1647254196170 }
}
```

#### VENTILATION_PHASE_STARTED message

As soon as a new ventilation phase has started client will receive the following message:

```json
{
  "type": "VENTILATION_PHASE_STARTED",
  "payload": {
    "epochMs": 1647254196170,
    "phase": { "phase": "inspiration", "type": "controlled" }
  }
}
```

Phase may have one of the following values:

- `inspiration`
- `expiration`
- `pause`
- `peep`

Type may have one of the following values:

- `controlled`: when phase is initiated by ventilation module
- `triggered`: when phase is patient-triggered

#### VENTILATION_PHASE_ENDED message

As soon as a new ventilation phase has ended client will receive the following message:

```json
{
  "type": "VENTILATION_PHASE_ENDED",
  "payload": {
    "epochMs": 1647254197170,
    "phase": { "phase": "inspiration", "type": "controlled" }
  }
}
```

#### VENTILATION_UNAVAILABLE message

Such message is sent when ventilation information cannot be read due to a missing ventilation module.

Client receives:

```json
{
  "type": "VENTILATION_UNAVAILABLE"
}
```

### Alarms channel

Subscription example:

```json
{
  "type": "SUBSCRIBE",
  "payload": ["alarms"]
}
```

#### ALARMS_SNAPSHOT

Right after subscription client will receive a snapshot like:

```json
{
  "type": "ALARMS_SNAPSHOT",
  "payload": {
    "activatedAlarms": ["ALARM_DISCONNECTION", "ALARM_LOW_BATTERY"]
  }
}
```

This payload includes currently active alarms.

#### ALARM_ACTIVATED

When an alarm is activated, client will receive a message like:

```json
{
  "type": "ALARM_ACTIVATED",
  "payload": {
    "epochMs": 1647509132380,
    "name": "ALARM_DISCONNECTION"
  }
}
```

#### ALARM_DEACTIVATED

When an alarm is deactivated, client will receive a message like:

```json
{
  "type": "ALARM_DEACTIVATED",
  "payload": {
    "epochMs": 1647509132380,
    "name": "ALARM_DISCONNECTION"
  }
}
```

Client should consider activated alarms as a set of unique names (like `ALARM_DISCONNECTION`).
This means that though same alarm might appear as activated multiple times when a deactivation is received, alarm is considered as not active.

#### ALARMS_INHIBITED

When alarms are inhibited, client will receive a message like:

```json
{
  "type": "ALARMS_INHIBITED",
  "payload": {
    "epochMs": 1647509219000,
    "remainingSeconds": 115,
    "totalSeconds": 120
  }
}
```

In message above, alarms are inhibited for a total of 120 seconds and 115 seconds remain before inhibition stop.

This kind of message will be sent periodically (like every 1 ou 2 seconds).
This way client can update the remaining seconds in near real time.

#### ALARMS_NOT_INHIBITED

When alarms are not inhibited, client will receive a message like:

```json
{
  "type": "ALARMS_NOT_INHIBITED"
}
```

#### ALARMS_UNAVAILABLE

Such message is sent when alarms cannot be read due to a missing ventilation module.

Client receives:

```json
{
  "type": "ALARMS_UNAVAILABLE"
}
```

## Troubleshooting

### Server does not send message anymore

Server might be disconnected due to USB failure or reboot.
As server uses timeouts on pong message to detect a silently disconnected client, client could do the same on its side.

Client could consider server as disconnected when:

- no ping has been received from a certain amount of time (like 20 s) or,
- no message has been received at all from server recently or,
- sent messages do not receive their corresponding responses (use reference property)

Client could reconnect to server automatically and send a new `START_COMMUNICATION` message.
