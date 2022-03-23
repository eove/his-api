import { webusb } from 'usb';

import { Logger } from '../tools';
import {
  UsbControlTransfer,
  UsbDevice,
  UsbDeviceFilter,
  UsbTimeouts,
} from './usbDevice';

interface FindUsbDeviceCreation {
  logger: Logger;
}

export function isUsbTimeoutError(error: Error) {
  return error.message.includes('LIBUSB_TRANSFER_TIMED_OUT');
}

export function createFindUsbDevice(creation: FindUsbDeviceCreation) {
  const { logger } = creation;
  return findUsbDevice;
  async function findUsbDevice(
    filters: UsbDeviceFilter[]
  ): Promise<UsbDevice | undefined> {
    return webusb
      .requestDevice({ filters })
      .then((d) => new NodeUsbDevice(d, logger))
      .catch(() => undefined);
  }
}

export class NodeUsbDevice implements UsbDevice {
  private readonly device: USBDevice;
  private readonly logger: Logger;

  constructor(device: USBDevice, logger: Logger) {
    this.device = device;
    this.logger = logger;
  }

  get productId(): number {
    return this.device.productId;
  }

  get vendorId(): number {
    return this.device.vendorId;
  }

  async open(): Promise<void> {
    this.logger.debug('Opening device');
    await this.device.open();
  }

  async claimInterface(interfaceNumber: number): Promise<void> {
    this.logger.debug(`Claiming interface ${interfaceNumber}`);
    await this.device.claimInterface(0);
  }

  setTimeouts(timeouts: UsbTimeouts, interfaceNumber: number): void {
    const { in: inValue, out: outValue } = timeouts;
    this.logger.debug(
      `Setting device timeouts (in: ${inValue}, out: ${outValue}, interface ${interfaceNumber})`
    );
    const theInterface = (this.device as any).device.interfaces[
      interfaceNumber
    ];
    for (const endpoint of theInterface.endpoints) {
      endpoint.timeout = endpoint.direction === 'out' ? outValue : inValue;
    }
  }

  get opened(): boolean {
    return this.device.opened;
  }

  async close(): Promise<void> {
    this.logger.debug('Closing device');
    await this.device.close();
  }

  async reset(): Promise<void> {
    this.logger.debug('Reseting device');
    try {
      await this.device.reset();
    } catch (error) {
      // ignored due to systematic LIBUSB_ERROR_NOT_FOUND error
    }
  }

  async transferOut(data: Buffer): Promise<void> {
    this.logger.debug(`Sending transfer out with ${data.length} bytes`);
    const result = await this.device.transferOut(1, data);
    this.ensureOutTransferOk(result, data.length);
  }

  async controlTransferOut(
    setup: UsbControlTransfer,
    data?: Buffer
  ): Promise<void> {
    const length = data ? data.length : 0;
    this.logger.debug(`Sending control transfer out with ${length} bytes`);
    const result = await this.device.controlTransferOut(
      setup as USBControlTransferParameters,
      data
    );
    this.ensureOutTransferOk(result, length);
  }

  private ensureOutTransferOk(
    result: USBOutTransferResult,
    expectedWrittenBytes: number
  ): void {
    const { bytesWritten, status } = result;
    if (status !== 'ok') {
      throw new Error(`Out transfer is not ok, status is ${status})`);
    }
    if (bytesWritten !== expectedWrittenBytes) {
      throw new Error(
        `Written bytes are ${bytesWritten} instead of ${expectedWrittenBytes}`
      );
    }
    this.logger.debug('Out transfer is ok');
  }

  async controlTransferIn(
    setup: UsbControlTransfer,
    length: number
  ): Promise<Buffer> {
    this.logger.debug('Sending control transfer in');
    const result = await this.device.controlTransferIn(
      setup as USBControlTransferParameters,
      length
    );
    const { status, data } = result;
    if (status !== 'ok') {
      throw new Error(`In transfer is not ok, status is ${status}`);
    }
    if (!data) {
      throw new Error('In transfer is not ok, data are missing');
    }
    return Buffer.from(data.buffer);
  }

  async transferIn(): Promise<Buffer> {
    this.logger.debug('Sending transfer in');
    const result = await this.device.transferIn(1, 1024);
    this.ensureInTransferOk(result);
    return result.data ? Buffer.from(result.data.buffer) : Buffer.alloc(0);
  }

  private ensureInTransferOk(result: USBInTransferResult): void {
    const { status } = result;
    if (status !== 'ok') {
      throw new Error(`In transfer is not ok, status is ${status})`);
    }
    this.logger.debug('In transfer is ok');
  }
}
