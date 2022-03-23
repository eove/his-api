import EventEmitter from 'events';

import { wait, Logger } from '../tools';
import { IsUsbTimeoutError, UsbDevice } from './usbDevice';

export interface UsbReaderCreation {
  readDelayMs: number;
  logger: Logger;
  isUsbTimeoutError: IsUsbTimeoutError;
}

export enum UsbReaderEvent {
  data = 'data',
  error = 'error',
}

export class UsbReader extends EventEmitter {
  private readonly logger: Logger;
  private readonly readDelayMs: number;
  private readonly isUsbTimeoutError: IsUsbTimeoutError;
  private running: boolean;
  private device?: UsbDevice;

  constructor(creation: UsbReaderCreation) {
    super();
    const { logger, readDelayMs, isUsbTimeoutError } = creation;
    this.logger = logger;
    this.readDelayMs = readDelayMs;
    this.isUsbTimeoutError = isUsbTimeoutError;
    this.running = false;
  }

  start(device: UsbDevice): void {
    this.logger.debug('Reading from USB device');
    this.device = device;
    this.resume();
  }

  stop(): void {
    this.logger.debug('No more reading from USB device');
    this.pause();
    this.device = undefined;
  }

  resume(): void {
    setImmediate(async () => {
      if (this.running) {
        return;
      }
      this.running = true;
      while (this.running && this.device) {
        await wait(this.readDelayMs);
        await this.read(this.device);
      }
    });
  }

  pause(): void {
    this.running = false;
  }

  private async read(device: UsbDevice): Promise<void> {
    if (!this.running) {
      return;
    }
    this.logger.debug('Reading from device');
    if (!device.opened) {
      throw new Error(
        'Impossible to read from device because we are not connected'
      );
    }
    try {
      const buffer = await device.transferIn();
      this.emit(UsbReaderEvent.data, buffer);
    } catch (error) {
      if (!this.running) {
        return;
      }
      if (error instanceof Error && this.isUsbTimeoutError(error)) {
        this.logger.debug('Read has timeouted');
        return;
      }
      this.emit(UsbReaderEvent.error, error);
    }
  }
}
