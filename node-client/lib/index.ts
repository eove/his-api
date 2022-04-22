import path from 'path';

import { HisClient, HisClientCreation } from './hisClient';
import { createConsoleLogger } from './tools';
import {
  createFindUsbDevice,
  createFindUsbDevices,
  AccessoryModeConfigurator,
  DeviceFinder,
  UsbReader,
  isUsbTimeoutError,
} from './usb';
import { MessageLineParser } from './message';

interface Creation extends Partial<HisClientCreation> {
  debugEnabled?: boolean;
  serialNumber?: string;
  vendorId?: number;
  productIds?: number[];
  accessoryModeProductIds?: number[];
  readDelayMs?: number;
  deviceDetectionTimeoutMs?: number;
  deviceDetectionPollingDelayMs?: number;
  accessoryManufacturer?: string;
  accessoryModel?: string;
  readBufferLength?: number;
  tokenFile?: string;
}

export function createHisClient(creation: Creation = {}): HisClient {
  const {
    debugEnabled = false,
    serialNumber,
    vendorId = 0x18d1,
    productIds = [0x4ee1, 0x4ee7],
    accessoryModeProductIds = [0x2d00, 0x2d01],
    readDelayMs = 50,
    deviceDetectionTimeoutMs = 10000,
    deviceDetectionPollingDelayMs = 1000,
    accessoryManufacturer = 'EOVE',
    accessoryModel = 'EoDisplayAccessory',
    inTimeoutMs = 1000,
    outTimeoutMs = 5000,
    readBufferLength = 10000,
    tokenFile,
  } = creation;
  const logger = createConsoleLogger({ debugEnabled });
  const findUsbDevice = createFindUsbDevice({ logger });
  const findUsbDevices = createFindUsbDevices({ logger });
  const deviceFinder = new DeviceFinder({
    serialNumber,
    vendorId,
    productIds,
    accessoryModeProductIds,
    timeoutMs: deviceDetectionTimeoutMs,
    pollingDelayMs: deviceDetectionPollingDelayMs,
    findUsbDevice,
    findUsbDevices,
    logger,
  });
  const usbReader = new UsbReader({ logger, readDelayMs, isUsbTimeoutError });
  const messageLineParser = new MessageLineParser({
    maxLineLength: readBufferLength,
  });
  const accessoryConfigurator = new AccessoryModeConfigurator({
    accessoryManufacturer,
    accessoryModel,
    logger,
  });
  const safeTokenFile = getTokenFile(tokenFile, serialNumber);
  return new HisClient(
    Object.assign(
      {
        deviceFinder,
        logger,
        usbReader,
        accessoryConfigurator,
        messageLineParser,
        inTimeoutMs,
        outTimeoutMs,
        tokenFile: safeTokenFile,
      },
      creation
    )
  );
}

function getTokenFile(
  fileMaybe: string | undefined,
  serialNumberMaybe: string | undefined
): string {
  if (fileMaybe) {
    return fileMaybe;
  }
  const suffix = serialNumberMaybe ? `-${serialNumberMaybe}` : '';
  return path.join(process.cwd(), `.token${suffix}`);
}

export * from './message';
export * from './tools';
export * from './hisClient';
