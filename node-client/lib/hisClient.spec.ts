import { EventEmitter } from 'events';

import { ClientEventType, HisClient, HisClientCreation } from './hisClient';
import { mock, samples } from './tests';
import { createSilentLogger, wait } from './tools';
import {
  MessageLineParser,
  MessageLineParserEventType,
  ServerMessageType,
  ClientMessageType,
  serializeMessage,
} from './message';
import {
  AccessoryModeConfigurator,
  DeviceFinder,
  UsbDevice,
  UsbReader,
  UsbReaderEvent,
} from './usb';

const UsbReaderMock = mock<UsbReader>(() =>
  Object.assign(new EventEmitter() as any, {
    start: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  })
);

const MessageLineParserMock = mock<MessageLineParser>(() =>
  Object.assign(new EventEmitter() as any, {
    append: jest.fn(),
  })
);

const AccessoryModeConfiguratorMock = mock<AccessoryModeConfigurator>(() => ({
  configure: jest.fn().mockResolvedValue(undefined),
}));

const DeviceFinderMock = mock<DeviceFinder>(() => ({
  waitForDeviceInAccessoryMode: jest.fn().mockResolvedValue(undefined),
  find: jest.fn().mockResolvedValue(undefined),
}));

describe('HIS client', () => {
  let events: any[][] = [];
  let usbReader: UsbReader;
  let messageLineParser: MessageLineParser;
  let accessoryModeConfigurator: AccessoryModeConfigurator;
  let deviceFinder: DeviceFinder;
  let client: HisClient;

  beforeEach(() => {
    usbReader = new UsbReaderMock();
    messageLineParser = new MessageLineParserMock();
    accessoryModeConfigurator = new AccessoryModeConfiguratorMock();
    deviceFinder = new DeviceFinderMock();
    events = [];
  });

  afterEach(() => {
    if (client) {
      client.dispose();
    }
  });

  describe('on data from reader', () => {
    it('should append them to parser', async () => {
      createClient();
      const buffer = Buffer.from('{"message":"hello"');

      usbReader.emit(UsbReaderEvent.data, buffer);

      await wait(50);
      expect(messageLineParser.append).toHaveBeenCalledWith(
        '{"message":"hello"'
      );
    });
  });

  describe('on error from reader', () => {
    it('should emit this error', async () => {
      createClient();

      usbReader.emit(UsbReaderEvent.error, new Error('bleh'));

      await wait(50);
      expect(events).toContainEqual([ClientEventType.error, new Error('bleh')]);
    });

    it('should stop reader', async () => {
      createClient();

      usbReader.emit(UsbReaderEvent.error, new Error('bleh'));

      await wait(50);
      expect(usbReader.stop).toHaveBeenCalled();
    });

    it('should emit a disconnected event', async () => {
      createClient();

      usbReader.emit(UsbReaderEvent.error, new Error('bleh'));

      await wait(50);
      expect(events).toContainEqual([ClientEventType.disconnected]);
    });
  });

  describe('on message from parser', () => {
    it('should emit it', async () => {
      createClient();

      messageLineParser.emit(MessageLineParserEventType.message, 'hello');

      await wait(50);
      expect(events).toContainEqual([ClientEventType.message, 'hello']);
    });

    describe('when ping is received', () => {
      it('should write a pong', async () => {
        const device = await connectToDeviceInAccessoryMode();

        messageLineParser.emit(MessageLineParserEventType.message, {
          type: ServerMessageType.ping,
        });

        await wait(50);
        const expected = serializeMessage({
          type: ClientMessageType.pong,
        });
        expect(device.transferOut).toHaveBeenCalledWith(expected);
      });
    });
  });

  describe('on error from parser', () => {
    it('should emit this error', async () => {
      createClient();

      messageLineParser.emit(
        MessageLineParserEventType.error,
        new Error('bleh')
      );

      await wait(50);
      expect(events).toContainEqual([ClientEventType.error, new Error('bleh')]);
    });
  });

  describe('on connect', () => {
    it('should configure and open device', async () => {
      const device = mockToFindDeviceInAccessoryMode();
      createClient({ inTimeoutMs: 42, outTimeoutMs: 1337 });

      await client.connect();

      expect(device.open).toHaveBeenCalled();
      expect(device.timeouts).toEqual({ in: 42, out: 1337 });
    });

    it('should emit a connected event', async () => {
      mockToFindDeviceInAccessoryMode();
      createClient();

      await client.connect();

      expect(events).toEqual([[ClientEventType.connected]]);
    });

    it('should start usb reader', async () => {
      const device = mockToFindDeviceInAccessoryMode();
      createClient();

      await client.connect();

      expect(usbReader.start).toHaveBeenCalledWith(device);
    });

    it('should put device in accessory mode if needed', async () => {
      const foundDevice = samples.createFoundDevice();
      const { device } = foundDevice;
      const foundDeviceInAccessoryMode =
        samples.createFoundDeviceInAccessoryMode();
      deviceFinder.find = jest.fn().mockResolvedValueOnce(foundDevice);
      deviceFinder.waitForDeviceInAccessoryMode = jest
        .fn()
        .mockResolvedValue(foundDeviceInAccessoryMode);
      createClient();

      await client.connect();

      expect(accessoryModeConfigurator.configure).toHaveBeenCalledWith(device);
    });

    it("won't put device in accessory mode if already in it", async () => {
      mockToFindDeviceInAccessoryMode();
      createClient();

      await client.connect();

      expect(accessoryModeConfigurator.configure).not.toHaveBeenCalled();
    });

    it('should rejects when device in accessory mode cannot be found', async () => {
      deviceFinder.find = jest
        .fn()
        .mockResolvedValue(samples.createFoundDevice());
      deviceFinder.waitForDeviceInAccessoryMode = jest
        .fn()
        .mockResolvedValue(undefined);
      createClient();

      const act = () => client.connect();

      return expect(act).rejects.toThrow(
        new Error('No device in accessory mode found')
      );
    });
  });

  describe('on reset', () => {
    it('should open device then reset', async () => {
      const foundDevice = samples.createFoundDevice();
      deviceFinder.find = jest.fn().mockResolvedValue(foundDevice);
      createClient();

      await client.reset();

      const { device } = foundDevice;
      expect(device.open).toHaveBeenCalled();
    });

    it('should throw when device is already opened', async () => {
      await connectToDeviceInAccessoryMode();

      const act = () => client.reset();

      await expect(act).rejects.toThrow(
        new Error('Cannot reset when connected')
      );
    });
  });

  describe('on disconnect', () => {
    it('should close device', async () => {
      const device = await connectToDeviceInAccessoryMode();

      await client.disconnect();

      expect(device.close).toHaveBeenCalled();
    });

    it('should stop reader', async () => {
      await connectToDeviceInAccessoryMode();

      await client.disconnect();

      expect(usbReader.stop).toHaveBeenCalled();
    });

    it('should emit a disconnected event', async () => {
      await connectToDeviceInAccessoryMode();

      await client.disconnect();

      expect(events).toContainEqual([ClientEventType.disconnected]);
    });
  });

  describe('on write', () => {
    it('should write using device', async () => {
      const device = await connectToDeviceInAccessoryMode();

      await client.write(Buffer.from([1]));

      expect(device.transferOut).toHaveBeenCalledWith(Buffer.from([1]));
    });

    it('should pause reader, write then resume reader', async () => {
      const calls: string[] = [];
      const device = await connectToDeviceInAccessoryMode();
      device.transferOut = jest
        .fn()
        .mockImplementation(async () => calls.push('transferOut'));
      usbReader.pause = jest
        .fn()
        .mockImplementation(async () => calls.push('pause'));
      usbReader.resume = jest
        .fn()
        .mockImplementation(async () => calls.push('resume'));

      await client.write(Buffer.from([1]));

      expect(calls).toEqual(['pause', 'transferOut', 'resume']);
    });

    it('should reject when no device is connected', () => {
      createClient();

      const act = client.write(Buffer.from([1]));

      return expect(act).rejects.toThrow(
        'Impossible to write because we are not connected'
      );
    });
  });

  async function connectToDeviceInAccessoryMode(): Promise<UsbDevice> {
    const device = mockToFindDeviceInAccessoryMode();
    createClient();
    await client.connect();
    return device;
  }

  function mockToFindDeviceInAccessoryMode(): UsbDevice {
    const foundDeviceInAccessoryMode =
      samples.createFoundDeviceInAccessoryMode();
    deviceFinder.find = jest.fn().mockResolvedValue(foundDeviceInAccessoryMode);
    deviceFinder.waitForDeviceInAccessoryMode = jest
      .fn()
      .mockResolvedValue(foundDeviceInAccessoryMode);
    return foundDeviceInAccessoryMode.device;
  }

  function createClient(creation: Partial<HisClientCreation> = {}): void {
    client = new HisClient(
      Object.assign(
        {
          deviceFinder,
          usbReader,
          accessoryConfigurator: accessoryModeConfigurator,
          logger: createSilentLogger(),
          messageLineParser: messageLineParser,
          inTimeoutMs: 0,
          outTimeoutMs: 0,
        },
        creation
      )
    );
    Object.values(ClientEventType).forEach((eventName) => {
      client.on(eventName, (...args) => events.push([eventName, ...args]));
    });
  }
});
