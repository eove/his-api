import { mock } from '../tests';
import { createSilentLogger, wait } from '../tools';
import { UsbDevice } from './usbDevice';
import { UsbReader, UsbReaderCreation, UsbReaderEvent } from './usbReader';

const UsbDeviceMock = mock<UsbDevice>(() => ({
  opened: true,
  transferIn: jest.fn().mockResolvedValue(Buffer.alloc(0)),
}));

describe('Usb reader', () => {
  let events: any[][] = [];
  let reader: UsbReader;

  beforeEach(() => {
    events = [];
  });

  afterEach(() => {
    if (reader) {
      reader.stop();
      reader.removeAllListeners();
    }
  });

  describe('while started', () => {
    it('should read from device and call data callback', async () => {
      createUsbReader();
      const device = new UsbDeviceMock();
      device.transferIn = jest.fn().mockResolvedValue(Buffer.from([1]));

      reader.start(device);

      await wait(50);
      expect(events).toContainEqual([UsbReaderEvent.data, Buffer.from([1])]);
    });

    it('should read periodically based on provided delay', async () => {
      createUsbReader({ readDelayMs: 100 });
      const device = new UsbDeviceMock();
      device.transferIn = jest
        .fn()
        .mockResolvedValueOnce(Buffer.from([1]))
        .mockResolvedValueOnce(Buffer.from([2]));

      reader.start(device);

      await wait(50);
      expect(events).toEqual([]);

      await wait(100);
      expect(events).toEqual([[UsbReaderEvent.data, Buffer.from([1])]]);

      await wait(100);
      expect(events).toEqual([
        [UsbReaderEvent.data, Buffer.from([1])],
        [UsbReaderEvent.data, Buffer.from([2])],
      ]);
    });

    it('should call error callback on any error', async () => {
      createUsbReader();
      const device = new UsbDeviceMock();
      device.transferIn = jest.fn().mockRejectedValue(new Error('bleh'));

      reader.start(device);

      await wait(50);
      expect(events).toContainEqual([UsbReaderEvent.error, new Error('bleh')]);
    });

    it("won't call error callback when error is timeout related", async () => {
      createUsbReader({
        isUsbTimeoutError: (error) => error.message.includes('timeout'),
      });
      const device = new UsbDeviceMock();
      device.transferIn = jest
        .fn()
        .mockRejectedValue(new Error('oups timeout'));

      reader.start(device);

      await wait(50);
      expect(events).toEqual([]);
    });

    it('should continue to read after any error', async () => {
      createUsbReader();
      const device = new UsbDeviceMock();
      device.transferIn = jest
        .fn()
        .mockRejectedValueOnce(new Error('bleh'))
        .mockResolvedValue(Buffer.from([1]));

      reader.start(device);

      await wait(50);
      expect(events).toContainEqual([UsbReaderEvent.data, Buffer.from([1])]);
    });
  });

  describe('while started then stopped', () => {
    it("it won't read device anymore", async () => {
      createUsbReader({ readDelayMs: 100 });
      const device = new UsbDeviceMock();
      device.transferIn = jest
        .fn()
        .mockResolvedValueOnce(Buffer.from([1]))
        .mockResolvedValueOnce(Buffer.from([2]));

      reader.start(device);

      await wait(50);
      expect(events).toEqual([]);

      await wait(100);
      expect(events).toEqual([[UsbReaderEvent.data, Buffer.from([1])]]);

      reader.stop();

      await wait(100);
      expect(events).toEqual([[UsbReaderEvent.data, Buffer.from([1])]]);
    });
  });

  describe('while started then paused', () => {
    it("it won't read device anymore", async () => {
      createUsbReader({ readDelayMs: 100 });
      const device = new UsbDeviceMock();
      device.transferIn = jest
        .fn()
        .mockResolvedValueOnce(Buffer.from([1]))
        .mockResolvedValueOnce(Buffer.from([2]));

      reader.start(device);

      await wait(50);
      expect(events).toEqual([]);

      await wait(100);
      expect(events).toEqual([[UsbReaderEvent.data, Buffer.from([1])]]);

      reader.pause();

      await wait(200);
      expect(events).toEqual([[UsbReaderEvent.data, Buffer.from([1])]]);
    });

    it("won't call error callback on error", async () => {
      createUsbReader();
      const device = new UsbDeviceMock();
      device.transferIn = jest.fn().mockImplementation(async () => {
        await wait(100);
        throw new Error('bleh');
      });
      reader.start(device);
      await wait(50);

      reader.pause();

      await wait(100);
      expect(events).toEqual([]);
    });
  });

  describe('while started then paused and finally resumed', () => {
    it('it should read device periodically', async () => {
      createUsbReader({ readDelayMs: 100 });
      const device = new UsbDeviceMock();
      device.transferIn = jest
        .fn()
        .mockResolvedValueOnce(Buffer.from([1]))
        .mockResolvedValueOnce(Buffer.from([2]));

      reader.start(device);

      await wait(150);

      reader.pause();

      await wait(200);

      reader.resume();

      await wait(150);
      expect(events).toEqual([
        [UsbReaderEvent.data, Buffer.from([1])],
        [UsbReaderEvent.data, Buffer.from([2])],
      ]);
    });
  });

  describe('while resumed multiple times', () => {
    it('it should read device normally and not multiple times', async () => {
      createUsbReader({ readDelayMs: 100 });
      const device = new UsbDeviceMock();
      device.transferIn = jest
        .fn()
        .mockResolvedValueOnce(Buffer.from([1]))
        .mockResolvedValueOnce(Buffer.from([2]));

      reader.start(device);

      await wait(150);

      reader.pause();

      await wait(200);

      reader.resume();
      reader.resume();
      reader.resume();

      await wait(150);
      expect(events).toEqual([
        [UsbReaderEvent.data, Buffer.from([1])],
        [UsbReaderEvent.data, Buffer.from([2])],
      ]);
    });
  });

  describe('while stopped', () => {
    it("it won't read device at all", async () => {
      createUsbReader({ readDelayMs: 10 });
      const device = new UsbDeviceMock();
      device.transferIn = jest.fn().mockResolvedValueOnce(Buffer.from([1]));

      await wait(100);
      expect(events).toEqual([]);
    });
  });

  function createUsbReader(creation: Partial<UsbReaderCreation> = {}): void {
    reader = new UsbReader(
      Object.assign(
        {
          logger: createSilentLogger(),
          readDelayMs: 10,
          isUsbTimeoutError: () => false,
        },
        creation
      )
    );
    Object.values(UsbReaderEvent).forEach((eventName) => {
      reader.on(eventName, (...args) => events.push([eventName, ...args]));
    });
  }
});
