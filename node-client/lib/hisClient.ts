import { EventEmitter } from 'events';
import { Buffer } from 'buffer';

import {
  ServerMessageType,
  Message,
  ClientMessageType,
  serializeMessage,
  MessageLineParserEventType,
  MessageLineParser,
} from './message';
import {
  UsbDevice,
  UsbTimeouts,
  UsbReader,
  UsbReaderEvent,
  DeviceFinder,
  AccessoryModeConfigurator,
} from './usb';
import { Logger } from './tools';

export interface HisClientCreation {
  accessoryConfigurator: AccessoryModeConfigurator;
  deviceFinder: DeviceFinder;
  logger: Logger;
  usbReader: UsbReader;
  messageLineParser: MessageLineParser;
  inTimeoutMs: number;
  outTimeoutMs: number;
}

export enum ClientEventType {
  connected = 'connected',
  disconnected = 'disconnected',
  message = 'message',
  error = 'error',
}

export class HisClient extends EventEmitter {
  private readonly logger: Logger;
  private readonly deviceFinder: DeviceFinder;
  private readonly usbReader: UsbReader;
  private readonly accessoryConfigurator: AccessoryModeConfigurator;
  private readonly messageLineParser: MessageLineParser;
  private readonly timeouts: UsbTimeouts;
  private disposeFunctions: (() => void)[];
  private device: UsbDevice | undefined;

  constructor(creation: HisClientCreation) {
    super();
    const {
      deviceFinder,
      logger,
      usbReader,
      accessoryConfigurator,
      messageLineParser,
      inTimeoutMs,
      outTimeoutMs,
    } = creation;
    this.usbReader = usbReader;
    this.accessoryConfigurator = accessoryConfigurator;
    this.logger = logger;
    this.deviceFinder = deviceFinder;
    this.messageLineParser = messageLineParser;
    this.timeouts = { in: inTimeoutMs, out: outTimeoutMs };
    this.disposeFunctions = [];
    this.listenToUsbReader();
    this.listenToMessageLineParser();
  }

  private listenToUsbReader() {
    const onData = this.onDataFromReader.bind(this);
    const onError = this.onErrorFromReader.bind(this);
    this.usbReader.on(UsbReaderEvent.data, onData);
    this.usbReader.on(UsbReaderEvent.error, onError);
    this.disposeFunctions.push(
      () => this.usbReader.removeListener(UsbReaderEvent.data, onData),
      () => this.usbReader.removeListener(UsbReaderEvent.error, onError)
    );
  }

  private listenToMessageLineParser() {
    const onMessage = this.onMessageFromParser.bind(this);
    const onError = this.onErrorFromParser.bind(this);
    this.messageLineParser.on(MessageLineParserEventType.message, onMessage);
    this.messageLineParser.on(MessageLineParserEventType.error, onError);
    this.disposeFunctions.push(
      () =>
        this.usbReader.removeListener(
          MessageLineParserEventType.message,
          onMessage
        ),
      () =>
        this.usbReader.removeListener(MessageLineParserEventType.error, onError)
    );
  }

  dispose(): void {
    this.disposeFunctions.forEach((f) => f());
    this.disposeFunctions = [];
    this.removeAllListeners();
  }

  private onDataFromReader(data: Buffer): void {
    this.messageLineParser.append(data.toString());
  }

  private onErrorFromReader(error: Error): void {
    this.logger.error('Impossible to read so forcing disconnection');
    this.emit(ClientEventType.error, error);
    this.disconnectSilently();
  }

  private onMessageFromParser(message: Message): void {
    this.emit(ClientEventType.message, message);
    if (message.type == ServerMessageType.ping) {
      this.writeMessage({ type: ClientMessageType.pong });
    }
  }

  private onErrorFromParser(error: Error): void {
    this.emit(ClientEventType.error, error);
  }

  get isConnected() {
    return this.device !== undefined;
  }

  async connect() {
    this.logger.info('Connecting');
    await this.putDeviceInAccessoryModeIfNeeded();

    const foundDevice = await this.deviceFinder.waitForDeviceInAccessoryMode();
    if (!foundDevice) {
      throw new Error('No device in accessory mode found');
    }
    const { device } = foundDevice;
    await device.open();
    device.timeouts = this.timeouts;
    this.device = device;
    this.usbReader.start(device);
    this.logger.info('Device is connected');
    this.emit(ClientEventType.connected);
  }

  async reset() {
    this.logger.info('Reseting');
    if (this.device) {
      throw new Error('Cannot reset when connected');
    }
    const foundDevice = await this.deviceFinder.find();
    if (!foundDevice) {
      throw new Error('No device found');
    }
    const { device } = foundDevice;
    await device.open();
    await device.reset();
    this.logger.info('Device is reset');
  }

  async disconnect() {
    this.logger.info('Disconnecting');
    await this.disconnectSilently();
    this.logger.info('Device is disconnected');
  }

  async writeMessage(message: Message): Promise<void> {
    return this.write(serializeMessage(message));
  }

  async write(bytes: Buffer): Promise<void> {
    this.logger.debug('Writing to device');
    if (!this.device) {
      throw new Error('Impossible to write because we are not connected');
    }
    try {
      this.usbReader.pause();
      await this.device.transferOut(bytes);
      this.usbReader.resume();
    } catch (error) {
      this.logger.error('Impossible to write so forcing disconnection');
      await this.disconnectSilently();
      throw error;
    }
  }

  private async putDeviceInAccessoryModeIfNeeded(): Promise<void> {
    const foundDeviceMaybe = await this.deviceFinder.find();
    if (!foundDeviceMaybe) {
      throw new Error('No device found');
    }
    const { device, inAccessoryMode } = foundDeviceMaybe;
    if (inAccessoryMode) {
      return;
    }
    return this.accessoryConfigurator.configure(device);
  }

  private async disconnectSilently() {
    if (this.device) {
      await this.device.close().catch(() => undefined);
    }
    this.usbReader.stop();
    this.device = undefined;
    this.emit(ClientEventType.disconnected);
  }
}
