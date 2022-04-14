import { performance } from 'perf_hooks';

import { Logger, wait } from '../tools';
import {
  FindUsbDevice,
  FindUsbDevices,
  UsbDevice,
  UsbDeviceFilter,
} from './usbDevice';

export interface FoundDevice {
  device: UsbDevice;
  inAccessoryMode: boolean;
}

export interface DeviceFinderCreation {
  serialNumber?: string;
  vendorId: number;
  productIds: number[];
  accessoryModeProductIds: number[];
  timeoutMs: number;
  pollingDelayMs: number;
  findUsbDevice: FindUsbDevice;
  findUsbDevices: FindUsbDevices;
  logger: Logger;
}

export class DeviceFinder {
  private readonly serialNumber: string | undefined;
  private readonly vendorId: number;
  private readonly productIds: number[];
  private readonly accessoryModeProductIds: number[];
  private readonly timeoutMs: number;
  private readonly pollingDelayMs: number;
  private readonly findUsbDevice: FindUsbDevice;
  private readonly findUsbDevices: FindUsbDevices;
  private readonly logger: Logger;

  constructor(creation: DeviceFinderCreation) {
    const {
      serialNumber,
      vendorId,
      productIds,
      accessoryModeProductIds,
      timeoutMs,
      pollingDelayMs,
      findUsbDevice,
      findUsbDevices,
      logger,
    } = creation;
    this.serialNumber = serialNumber;
    this.vendorId = vendorId;
    this.productIds = productIds;
    this.accessoryModeProductIds = accessoryModeProductIds;
    this.timeoutMs = timeoutMs;
    this.pollingDelayMs = pollingDelayMs;
    this.logger = logger;
    this.findUsbDevice = findUsbDevice;
    this.findUsbDevices = findUsbDevices;
  }

  public async waitForDeviceInAccessoryMode(): Promise<FoundDevice> {
    const startTime = performance.now();
    while (performance.now() - startTime < this.timeoutMs) {
      const result = await this.findMaybe();
      if (result && result.inAccessoryMode) {
        return result;
      }
      this.logger.debug(
        `No device in accessory mode found yet, retrying in ${this.pollingDelayMs} ms`
      );
      await wait(this.pollingDelayMs);
    }
    throw this.createNoDeviceFoundError('No device in accessory mode found');
  }

  public async find(): Promise<FoundDevice> {
    const foundMaybe = await this.findMaybe();
    if (!foundMaybe) {
      throw this.createNoDeviceFoundError('No device found');
    }
    return foundMaybe;
  }

  private async findMaybe(): Promise<FoundDevice | undefined> {
    const filters = this.createUsbFilters();
    const device = await this.findUsbDevice(filters);
    if (!device) {
      return undefined;
    }
    const inAccessoryMode = this.accessoryModeProductIds.includes(
      device.productId
    );
    return { device, inAccessoryMode };
  }

  public async findAll(): Promise<FoundDevice[]> {
    const filters = this.createUsbFilters();
    const devices = await this.findUsbDevices(filters);
    return devices.map((device) => {
      const inAccessoryMode = this.accessoryModeProductIds.includes(
        device.productId
      );
      return { device, inAccessoryMode };
    });
  }

  private createUsbFilters(): UsbDeviceFilter[] {
    const productIds = this.productIds.concat(this.accessoryModeProductIds);
    return productIds.map((productId) => {
      const filters: UsbDeviceFilter = this.serialNumber
        ? { serialNumber: this.serialNumber }
        : {};
      filters.vendorId = this.vendorId;
      filters.productId = productId;
      return filters;
    });
  }

  private createNoDeviceFoundError(baseMessage: string) {
    const suffix =
      this.serialNumber !== undefined
        ? ` for serial number ${this.serialNumber}`
        : '';
    return new Error(`${baseMessage}${suffix}`);
  }
}
