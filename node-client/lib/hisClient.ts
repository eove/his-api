import { EventEmitter } from 'events';
import { Buffer } from 'buffer';
import { readFile, writeFile } from 'fs/promises';

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
  FoundDevice,
} from './usb';
import { Logger, wait } from './tools';

export interface HisClientCreation {
  accessoryConfigurator: AccessoryModeConfigurator;
  deviceFinder: DeviceFinder;
  logger: Logger;
  usbReader: UsbReader;
  messageLineParser: MessageLineParser;
  inTimeoutMs: number;
  outTimeoutMs: number;
  tokenFile: string;
}

export enum ClientEventType {
  connected = 'connected',
  disconnected = 'disconnected',
  messageReceived = 'messageReceived',
  messageSent = 'messageSent',
  error = 'error',
}

export const accessoryInterfaceNumber = 0;

export class HisClient extends EventEmitter {
  private readonly logger: Logger;
  private readonly deviceFinder: DeviceFinder;
  private readonly usbReader: UsbReader;
  private readonly accessoryConfigurator: AccessoryModeConfigurator;
  private readonly messageLineParser: MessageLineParser;
  private readonly timeouts: UsbTimeouts;
  private readonly tokenFile: string;
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
      tokenFile,
    } = creation;
    this.usbReader = usbReader;
    this.accessoryConfigurator = accessoryConfigurator;
    this.logger = logger;
    this.deviceFinder = deviceFinder;
    this.messageLineParser = messageLineParser;
    this.timeouts = { in: inTimeoutMs, out: outTimeoutMs };
    this.tokenFile = tokenFile;
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
    this.emit(ClientEventType.messageReceived, message);
    switch (message.type) {
      case ServerMessageType.ping:
        this.writeMessage({ type: ClientMessageType.pong });
        break;
      case ServerMessageType.startCommunicationSucceeded:
        this.handleStartCommunicationSucceeded(message);
        break;
    }
  }

  private async handleStartCommunicationSucceeded(message: Message) {
    const token = message?.payload?.token;
    if (!token) {
      return;
    }
    try {
      await writeFile(this.tokenFile, token);
    } catch (error) {
      this.logger.error('Error while storing token', error);
      this.emit(ClientEventType.error, error);
    }
  }

  private onErrorFromParser(error: Error): void {
    this.emit(ClientEventType.error, error);
  }

  get isConnected() {
    return this.device !== undefined;
  }

  async connect() {
    this.logger.debug('Connecting');
    await this.putDeviceInAccessoryModeIfNeeded();

    const foundDevice = await this.deviceFinder.waitForDeviceInAccessoryMode();
    const { device } = foundDevice;
    await device.open();
    await device.claimInterface(accessoryInterfaceNumber);
    device.setTimeouts(this.timeouts, accessoryInterfaceNumber);
    this.device = device;
    this.usbReader.start(device);
    this.logger.debug('Device is connected');
    this.emit(ClientEventType.connected);
  }

  async findDevices(): Promise<FoundDevice[]> {
    this.logger.debug('Finding devices');
    return this.deviceFinder.findAll();
  }

  async reset() {
    this.logger.debug('Reseting');
    if (this.device) {
      throw new Error('Cannot reset when connected');
    }
    const foundDevice = await this.deviceFinder.find();
    const { device } = foundDevice;
    await device.open();
    await device.reset();
    this.logger.debug('Device is reset');
  }

  async disconnect() {
    this.logger.debug('Disconnecting');
    await this.disconnectSilently();
    this.logger.debug('Device is disconnected');
  }

  async startCommunication(): Promise<void> {
    const token = await this.readTokenIfAny();
    const withPayloadMaybe = token ? { payload: { token } } : {};
    this.writeMessage(
      Object.assign(
        {
          type: ClientMessageType.startCommunication,
        },
        withPayloadMaybe
      )
    );
  }

  private readTokenIfAny(): Promise<string | undefined> {
    this.logger.debug(`Reading token from ${this.tokenFile}`);
    return readFile(this.tokenFile, { encoding: 'utf-8' }).catch((error) => {
      if (error.code !== 'ENOENT') {
        this.logger.error('Unexpected error while reading token', error);
        this.emit(ClientEventType.error, error);
      }
      return undefined;
    });
  }

  async writeMessage(message: Message): Promise<void> {
    this.emit(ClientEventType.messageSent, message);
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
    const foundDevice = await this.deviceFinder.find();
    const { device, inAccessoryMode } = foundDevice;
    if (inAccessoryMode) {
      return;
    }
    return this.accessoryConfigurator.configure(device);
  }

  private async disconnectSilently() {
    this.usbReader.stop();
    await this.closeDevice();
    this.device = undefined;
    this.emit(ClientEventType.disconnected);
  }

  private async closeDevice(): Promise<void> {
    for (let i = 0; i < 2; i++) {
      try {
        if (!this.device) {
          return;
        }
        await this.device.close();
      } catch (error) {
        this.logger.debug('Impossible to close device for now');
        await wait(this.timeouts.in);
      }
    }
  }
}
