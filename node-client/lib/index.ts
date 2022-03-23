import { HisClient, HisClientCreation } from './hisClient';
import { createConsoleLogger } from './tools';
import {
  createFindUsbDevice,
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
    accessoryManufacturer = 'Eove',
    accessoryModel = 'EoDisplayAccessory',
    inTimeoutMs = 1000,
    outTimeoutMs = 5000,
    readBufferLength = 10000,
  } = creation;
  const logger = createConsoleLogger({ debugEnabled });
  const findUsbDevice = createFindUsbDevice({ logger });
  const deviceFinder = new DeviceFinder({
    serialNumber,
    vendorId,
    productIds,
    accessoryModeProductIds,
    timeoutMs: deviceDetectionTimeoutMs,
    pollingDelayMs: deviceDetectionPollingDelayMs,
    findUsbDevice,
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
      },
      creation
    )
  );
}

export * from './message';
export * from './tools';
export * from './hisClient';
