import { UsbDevice, FoundDevice } from '../usb';
import { mock } from './mock';

export const UsbDeviceMock = mock<UsbDevice>(() => ({
  open: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  timeout: 0,
  vendorId: 0,
  productId: 0,
  transferOut: jest.fn().mockResolvedValue(undefined),
  transferIn: jest.fn().mockResolvedValue(undefined),
  controlTransferIn: jest.fn().mockResolvedValue(undefined),
  controlTransferOut: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn().mockResolvedValue(undefined),
}));

function createDevice(): UsbDevice {
  return Object.assign(new UsbDeviceMock(), {
    vendorId: 1,
    productId: 10,
  });
}

function createDeviceInAccessoryMode(): UsbDevice {
  return Object.assign(new UsbDeviceMock(), {
    vendorId: 1,
    productId: 100,
  });
}

function createFoundDevice(): FoundDevice {
  return { device: createDevice(), inAccessoryMode: false };
}

function createFoundDeviceInAccessoryMode(): FoundDevice {
  return { device: createDeviceInAccessoryMode(), inAccessoryMode: true };
}

export const samples = {
  createDevice,
  createFoundDevice: createFoundDevice,
  createDeviceInAccessoryMode,
  createFoundDeviceInAccessoryMode,
};
