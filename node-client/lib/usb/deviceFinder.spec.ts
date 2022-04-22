import { isEqual } from 'lodash/fp';

import { DeviceFinder, DeviceFinderCreation } from './deviceFinder';
import { samples, createSilentLogger } from '../tests';
import { FindUsbDevice, FindUsbDevices } from './usbDevice';

describe('Device finder', () => {
  let findUsbDevice: FindUsbDevice;
  let findUsbDevices: FindUsbDevices;
  let finder: DeviceFinder;

  beforeEach(() => {
    findUsbDevice = jest.fn().mockResolvedValue(undefined);
    findUsbDevices = jest.fn().mockResolvedValue(undefined);
  });

  describe('on find', () => {
    it('should find device using all configured ids', async () => {
      const device = samples.createDevice();
      findUsbDevice = jest.fn().mockImplementation(async (filters) => {
        if (
          !isEqual(filters, [
            { vendorId: 1, productId: 10 },
            { vendorId: 1, productId: 11 },
            { vendorId: 1, productId: 100 },
            { vendorId: 1, productId: 101 },
          ])
        ) {
          return undefined;
        }
        return device;
      });
      createDeviceFinder({
        vendorId: 1,
        productIds: [10, 11],
        accessoryModeProductIds: [100, 101],
      });

      const found = await finder.find();

      expect(found).toEqual({ device, inAccessoryMode: false });
    });

    it('should find device using serial number when provided', async () => {
      const device = samples.createDevice();
      findUsbDevice = jest.fn().mockImplementation(async (filters) => {
        if (
          !isEqual(filters, [
            { serialNumber: 'aae', vendorId: 1, productId: 10 },
            { serialNumber: 'aae', vendorId: 1, productId: 100 },
          ])
        ) {
          return undefined;
        }
        return device;
      });
      createDeviceFinder({
        serialNumber: 'aae',
        vendorId: 1,
        productIds: [10],
        accessoryModeProductIds: [100],
      });

      const found = await finder.find();

      expect(found).toEqual({ device, inAccessoryMode: false });
    });

    it('should consider device is not in accessory mode based on product id', async () => {
      findUsbDevice = jest.fn().mockResolvedValue(samples.createDevice());
      createDeviceFinder();

      const found = await finder.find();

      expect(found).toMatchObject({ inAccessoryMode: false });
    });

    it('should consider device is in accessory mode based on product id', async () => {
      findUsbDevice = jest
        .fn()
        .mockResolvedValue(samples.createDeviceInAccessoryMode());
      createDeviceFinder();

      const found = await finder.find();

      expect(found).toMatchObject({ inAccessoryMode: true });
    });

    it('should throw when no device can be found', () => {
      findUsbDevice = jest.fn().mockResolvedValue(undefined);
      createDeviceFinder();

      const act = finder.find();

      return expect(act).rejects.toThrow('No device found');
    });

    it('should throw providing serial number if any when no device can be found', () => {
      findUsbDevice = jest.fn().mockResolvedValue(undefined);
      createDeviceFinder({ serialNumber: 'x24' });

      const act = finder.find();

      return expect(act).rejects.toThrow(
        'No device found for serial number x24'
      );
    });
  });

  describe('on find all', () => {
    it('should find devices using all configured ids', async () => {
      const device1 = samples.createDevice();
      const device2 = samples.createDevice();
      findUsbDevices = jest.fn().mockImplementation(async (filters) => {
        if (
          !isEqual(filters, [
            { vendorId: 1, productId: 10 },
            { vendorId: 1, productId: 11 },
            { vendorId: 1, productId: 100 },
            { vendorId: 1, productId: 101 },
          ])
        ) {
          return undefined;
        }
        return [device1, device2];
      });
      createDeviceFinder({
        vendorId: 1,
        productIds: [10, 11],
        accessoryModeProductIds: [100, 101],
      });

      const result = await finder.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ device: device1, inAccessoryMode: false });
      expect(result[1]).toEqual({ device: device2, inAccessoryMode: false });
    });

    it('should consider device is in accessory mode based on product id', async () => {
      findUsbDevices = jest
        .fn()
        .mockResolvedValue([samples.createDeviceInAccessoryMode()]);
      createDeviceFinder();

      const result = await finder.findAll();

      expect(result[0]).toMatchObject({ inAccessoryMode: true });
    });

    it('could find no device at all', async () => {
      findUsbDevices = jest.fn().mockResolvedValue([]);
      createDeviceFinder();

      const result = await finder.findAll();

      expect(result).toHaveLength(0);
    });
  });

  describe('on wait for device in accessory mode', () => {
    it('should wait the provided delay when device is put in accessory mode', async () => {
      const device = samples.createDevice();
      const deviceInAccessoryMode = samples.createDeviceInAccessoryMode();
      let inAccessoryMode = false;
      setTimeout(() => {
        inAccessoryMode = true;
      }, 150);
      findUsbDevice = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(inAccessoryMode ? deviceInAccessoryMode : device)
        );
      createDeviceFinder({
        pollingDelayMs: 100,
        timeoutMs: 500,
      });

      const found = await finder.waitForDeviceInAccessoryMode();

      expect(found).toMatchObject({ device: deviceInAccessoryMode });
    });

    it('should wait the provided delay though device might disappear during the process', async () => {
      const deviceInAccessoryMode = samples.createDeviceInAccessoryMode();
      let inAccessoryMode = false;
      setTimeout(() => {
        inAccessoryMode = true;
      }, 150);
      findUsbDevice = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(inAccessoryMode ? deviceInAccessoryMode : undefined)
        );
      createDeviceFinder({
        pollingDelayMs: 100,
        timeoutMs: 500,
      });

      const found = await finder.waitForDeviceInAccessoryMode();

      expect(found).toMatchObject({ device: deviceInAccessoryMode });
    });

    it('should throw when no device can be found in time', () => {
      const device = samples.createDevice();
      const deviceInAccessoryMode = samples.createDeviceInAccessoryMode();
      let inAccessoryMode = false;
      setTimeout(() => {
        inAccessoryMode = true;
      }, 300);
      findUsbDevice = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(inAccessoryMode ? deviceInAccessoryMode : device)
        );
      createDeviceFinder({
        pollingDelayMs: 50,
        timeoutMs: 200,
      });

      const act = finder.waitForDeviceInAccessoryMode();

      return expect(act).rejects.toThrow('No device in accessory mode found');
    });

    it('should throw providing serial number if any when no device can be found', () => {
      const device = samples.createDevice();
      const deviceInAccessoryMode = samples.createDeviceInAccessoryMode();
      let inAccessoryMode = false;
      setTimeout(() => {
        inAccessoryMode = true;
      }, 300);
      findUsbDevice = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(inAccessoryMode ? deviceInAccessoryMode : device)
        );
      createDeviceFinder({
        serialNumber: 'x24',
        pollingDelayMs: 50,
        timeoutMs: 200,
      });

      const act = finder.waitForDeviceInAccessoryMode();

      return expect(act).rejects.toThrow(
        'No device in accessory mode found for serial number x24'
      );
    });
  });

  function createDeviceFinder(
    creation: Partial<DeviceFinderCreation> = {}
  ): void {
    finder = new DeviceFinder(
      Object.assign(
        {
          vendorId: 1,
          productIds: [10, 11],
          accessoryModeProductIds: [100, 101],
          timeoutMs: 1000,
          pollingDelayMs: 50,
          findUsbDevice,
          findUsbDevices,
          logger: createSilentLogger(),
        },
        creation
      )
    );
  }
});
