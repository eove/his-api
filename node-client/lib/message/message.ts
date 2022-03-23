export interface Message {
  type: string;
  reference?: string;
  payload?: Record<string, any>;
}

export enum ClientMessageType {
  pong = 'PONG',
  startCommunication = 'START_COMMUNICATION',
  stopCommunication = 'STOP_COMMUNICATION',
  getInformation = 'GET_INFORMATION',
  subscribe = 'SUBSCRIBE',
  unsubscribe = 'UNSUBSCRIBE',
}

export enum ServerMessageType {
  ping = 'PING',
}

export function serializeMessage(message: Message): Buffer {
  const json = JSON.stringify(message);
  const jsonLine = json + '\n';
  return Buffer.from(jsonLine);
}

export function ensureMessage(messageMaybe: unknown): Message {
  if (!isMessage(messageMaybe)) {
    throw new Error('Object is not a message');
  }
  return messageMaybe;
}

function isMessage(object: unknown): object is Message {
  const anyObject = object as any;
  return (
    object !== undefined &&
    object !== null &&
    typeof object === 'object' &&
    anyObject.type !== undefined &&
    anyObject.type !== null &&
    typeof anyObject.type === 'string'
  );
}

export enum SubscriptionChannel {
  waveforms = 'waveforms',
  monitorings = 'monitorings',
  settings = 'settings',
  alarms = 'alarms',
  ventilation = 'ventilation',
}
