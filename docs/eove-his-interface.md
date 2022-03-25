# EOVE HIS interface

## Foreword

To ease the monitoring of several devices in a hospital environment, a way to collect and gather each device data is required.
The goal is to provide a dashboard to nurses, and avoid the need to physically move to patients room to check ventilation status.
As a ventilation device manufacturer, EOVE provides an interface on its devices to export live data.
It does not deal with the display of these data to nurses.

## Hardware setup

The function is available for EOVE-150 products running at least EOVE-150 application version `3.2.0 (TBC)`

It uses a wired connection which requires a USB 2.0 cable with a micro USB plug.

As an EOVE-150 product is made of two components : a ventilation module and a docking station, the data from the ventilation module will be available only if :

- the ventilation module is turned ON
- the ventilation module is inserted in the docking station

## Software setup

The EOVE-150 station is put in USB accessory mode and delivers data to an accessory acting as USB host

### Link level

The link protocol is Android Open Accessory as described in https://source.android.com/devices/accessories/protocol.

The EOVE-150 station is put in USB accessory mode and delivers data to an accessory acting as USB host

### Application level

The EOVE-150 application acts as a server that responds to client sollicitations.

## Reference implementation

EOVE provides a reference implementation that includes a [Node.JS client](https://github.com/eove/his-api/tree/master/node-client).

This client is able to perform all the steps needed in order to retrieve live data from a running ventialtion device.

The main steps a client must perform are :

- trigger the accessory mode on the EO150 station
- write message to start a high level communication
- write message in order to subscribe to channels
- read data from EO150 station
- respond to EO150 station pings to keep the link alive

## Data format

Data exchanged over USB link are JSON strings separated by a new line character and encoded in UTF-8 bytes.

Example of such string before UTF-8 encoding:

```
{"type":"START_COMMUNICATION"}\n
```

Client sends messages and get replies.

## Plumbing

### Accessory mode

- prerequisite : usb cable plugged on micro USB port

Trigger Accessory Mode according to https://source.android.com/devices/accessories/aoa.

Reference implementation in `his-api/node-client/lib/usb/accessoryModeConfigurator.ts`.

### Communication start

- prerequisite : accessory mode triggered

Client writes:

```json
{
  "type": "START_COMMUNICATION"
}
```

Upon success, client reads:

```json
{
  "type": "START_COMMUNICATION_SUCCEEDED"
}
```

### Communication ping

To keep the connection alive, pings are emitted periodicaly by the server (typically every 8s).
The client shall reply with pongs messages before the timeout (typically 5s).

Client reads:

```json
{ "type": "PING" }
```

Client writes:

```json
{ "type": "PONG" }
```

### Reference

An optional `reference` field is available to help the client link messages and replies.
The server returns the `reference` field provided unchanged in its replies.

Client writes:

```json
{
  "type": "START_COMMUNICATION",
  "reference": "1"
}
```

As a response, client reads:

```json
{
  "type": "START_COMMUNICATION_SUCCEEDED",
  "reference": "1"
}
```

## Identification data

- prerequisite : communication started

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
      "applicationVersion": "3.2.0-dev.3",
      "systemVersion": "eove-eodisplay-2.2.1",
      "bootloaderVersion": "2017.12.0-EOVE_v1.2.2-g598a8e923"
    }
  }
}
```

Note: ventilation module data are available only if the ventilation module is turned ON and inserted in the docking station.

## Ventilation data

The ventilation data are provided through subscription to channels.

The client sends `SUBSCRIBE` or `UNSUBSCRIBE` commands for a given channel.

Available channels are:

- `waveforms`: to receive a batch of waveforms
- `monitorings`: to receive monitorings updates
- `settings`: to receive settings updates for current ventilation mode
- `alarms`: to receive alarms activations/deactivations
- `ventilation`: to receive ventilation related information and updates

The response to a subscription is an initial `snapshot`, followed by `patches` to update the data.

When ventilaton module reconnects a snapshot is sent before any patch.
Client can then replace all the state he or she has built so far.

Snapshot/patch payloads include `newborn` information when patient type is pediatric.
When patient type becomes adult, `newborn` information is set to `UNAVAILABLE` in patch's payload.
Generally speaking any information missing from previous state in current state is set to `UNAVAILABLE` in patch's payload.
This is a way to represent the absence of information in a incremental update.

### Waveforms

- prerequisite : communication started

#### Subscription

Client sends:

```json
{
  "type": "SUBSCRIBE",
  "payload": ["waveforms"]
}
```

Upon success, clients receives:

```json
{ "type": "SUBSCRIBE_SUCCEEDED" }
```

#### Data

Waveforms can be built from a stream of samples that contain timestamp, pressure, flow, and volume.
A sample is a table with this format : `[number (epoch ms), number, number, number]`.

For compacity and performance, samples are grouped in 12-sample chunks such as :

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

- `WAVEFORMS_UNAVAILABLE`: message sent when waveforms cannot be read due to a missing ventilation module

Waveforms have no snapshot/patch distinction because we send all components every time (volume, flow, etc.).

### Monitorings

#### Subscription

Client sends:

```json
{
  "type": "SUBSCRIBE",
  "payload": ["monitorings"]
}
```

Upon success, clients receives:

```json
{ "type": "SUBSCRIBE_SUCCEEDED" }
```

#### Received data

At first, all data is new, so the first message contains all values. Further messages will only hold updates.

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

- `MONITORINGS_UNAVAILABLE`: message sent when monitorings cannot be read due to a missing ventilation module
- `MONITORINGS_SNAPSHOT`: a message including monitorings current state
- `MONITORINGS_PATCH`: a message including monitorings updates

### Settings

#### Subscription

Client sends:

```json
{
  "type": "SUBSCRIBE",
  "payload": ["settings"]
}
```

Upon success, clients receives:

```json
{ "type": "SUBSCRIBE_SUCCEEDED" }
```

#### Received data

First message:

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

Data update:

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

- `SETTINGS_UNAVAILABLE`: message sent when settings cannot be read due to a missing ventilation module
- `SETTINGS_SNAPSHOT`: a message including settings, alarm settings, mode, etc.
- `SETTINGS_PATCH`: a message including updated informations about settings, alarm settings, etc.

### Ventilation

#### Subscription

Client sends:

```json
{
  "type": "SUBSCRIBE",
  "payload": ["ventilation"]
}
```

Upon success, clients receives:

```json
{ "type": "SUBSCRIBE_SUCCEEDED" }
```

#### Received data

```json
{
  "type": "VENTILATION_STATE",
  "payload": { "mode": "SET_AI", "started": true }
}
```

```json
{
  "type": "VENTILATION_PHASE_STARTED",
  "payload": {
    "epochMs": 1647254196170,
    "phase": { "phase": "inspiration", "type": "controlled" }
  }
}
```

```json
{
  "type": "VENTILATION_PHASE_ENDED",
  "payload": {
    "epochMs": 1647254197170,
    "phase": { "phase": "inspiration", "type": "controlled" }
  }
}
```

- `VENTILATION_UNAVAILABLE`: message sent when ventilation cannot be read due to a missing ventilation module

### Alarms
