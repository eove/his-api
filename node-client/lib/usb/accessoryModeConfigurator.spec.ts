import { isEqual } from 'lodash/fp';

import {
  AccessoryModeConfigurator,
  AccessoryModeConfiguratorCreation,
} from './accessoryModeConfigurator';
import { samples, createSilentLogger } from '../tests';
import { UsbDevice } from './usbDevice';

describe('Accessory mode configurator', () => {
  let configurator: AccessoryModeConfigurator;

  describe('on configure', () => {
    it('should send accessory configuration then start mode', async () => {
      const device = samples.createDevice();
      mockToReturnVersionCode(device);
      createAccessoryConfigurator();

      await configurator.configure(device);

      expect(device.open).toHaveBeenCalled();
      expectInformationToHaveBeenSent(device, 'Manufacturer', 0);
      expectInformationToHaveBeenSent(device, 'Model', 1);
      expectInformationToHaveBeenSent(device, '', 2);
      expectInformationToHaveBeenSent(device, '', 3);
      expectInformationToHaveBeenSent(device, '', 4);
      expectInformationToHaveBeenSent(device, '', 5);
      expectAccessoryModeStarted(device);
      expect(device.close).toHaveBeenCalled();
    });
  });

  function expectInformationToHaveBeenSent(
    device: UsbDevice,
    piece: string,
    index: number
  ): void {
    const buffer = Buffer.from(`${piece}\0`);
    expect(device.controlTransferOut).toHaveBeenCalledWith(
      {
        recipient: 'device',
        requestType: 'vendor',
        request: 52,
        value: 0,
        index,
      },
      buffer
    );
  }

  function expectAccessoryModeStarted(device: UsbDevice): void {
    expect(device.controlTransferOut).toHaveBeenCalledWith({
      recipient: 'device',
      requestType: 'vendor',
      request: 53,
      value: 0,
      index: 0,
    });
  }

  function mockToReturnVersionCode(device: UsbDevice, code = 2): void {
    device.controlTransferIn = jest.fn().mockImplementation((setup, length) => {
      if (
        !isEqual(setup, {
          recipient: 'device',
          requestType: 'vendor',
          request: 51,
          value: 0,
          index: 0,
        }) ||
        length !== 2
      ) {
        return Buffer.alloc(0);
      }
      const result = Buffer.alloc(2);
      result.writeInt16LE(code);
      return result;
    });
  }

  function createAccessoryConfigurator(
    creation: Partial<AccessoryModeConfiguratorCreation> = {}
  ): void {
    configurator = new AccessoryModeConfigurator(
      Object.assign(
        {
          accessoryManufacturer: 'Manufacturer',
          accessoryModel: 'Model',
          logger: createSilentLogger(),
        },
        creation
      )
    );
  }
});
