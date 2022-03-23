import { Logger } from '../tools';
import { UsbDevice } from './usbDevice';

export interface AccessoryModeConfiguratorCreation {
  accessoryManufacturer: string;
  accessoryModel: string;
  logger: Logger;
}

export class AccessoryModeConfigurator {
  private readonly accessoryManufacturer: string;
  private readonly accessoryModel: string;
  private readonly logger: Logger;

  constructor(creation: AccessoryModeConfiguratorCreation) {
    const { accessoryManufacturer, accessoryModel, logger } = creation;
    this.accessoryManufacturer = accessoryManufacturer;
    this.accessoryModel = accessoryModel;
    this.logger = logger;
  }

  async configure(device: UsbDevice) {
    this.logger.info('Putting device in accessory mode');
    try {
      await device.open();
      await this.validateVersionCode(device);
      await this.sendAccessoryInformation(device);
      await this.startAccessoryMode(device);
    } finally {
      await device.close();
    }
  }

  private async validateVersionCode(device: UsbDevice): Promise<void> {
    this.logger.debug('Validating version code');
    const result = await device.controlTransferIn(
      {
        recipient: 'device',
        requestType: 'vendor',
        request: 51,
        value: 0,
        index: 0,
      },
      2
    );
    if (result.length !== 2 || result.readInt16LE() !== 2) {
      throw new Error('Impossible to validate version code');
    }
  }

  private async sendAccessoryInformation(device: UsbDevice): Promise<void> {
    this.logger.debug('Sending accessory information');
    const information = [
      this.accessoryManufacturer,
      this.accessoryModel,
      '',
      '',
      '',
      '',
    ].map((s) => `${s}\0`);
    for (let i = 0; i < information.length; i++) {
      const piece = Buffer.from(information[i]);
      await device.controlTransferOut(
        {
          recipient: 'device',
          requestType: 'vendor',
          request: 52,
          value: 0,
          index: i,
        },
        piece
      );
    }
  }

  private async startAccessoryMode(device: UsbDevice): Promise<void> {
    this.logger.debug('Starting accessory mode');
    await device.controlTransferOut({
      recipient: 'device',
      requestType: 'vendor',
      request: 53,
      value: 0,
      index: 0,
    });
  }
}
