export interface UsbControlTransfer {
  recipient: string;
  requestType: string;
  request: number;
  value: number;
  index: number;
}

export interface UsbTimeouts {
  in: number;
  out: number;
}

export interface UsbDevice {
  get productId(): number;
  get vendorId(): number;
  open(): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  get opened(): boolean;
  setTimeouts(timeouts: UsbTimeouts, interfaceNumber: number): void;
  close(): Promise<void>;
  reset(): Promise<void>;
  transferOut(data: Buffer): Promise<void>;
  transferIn(): Promise<Buffer>;
  controlTransferIn(setup: UsbControlTransfer, length: number): Promise<Buffer>;
  controlTransferOut(setup: UsbControlTransfer, buffer?: Buffer): Promise<void>;
}

export interface UsbDeviceFilter {
  serialNumber?: string;
  vendorId?: number;
  productId?: number;
}

export type FindUsbDevice = (
  filters: UsbDeviceFilter[]
) => Promise<UsbDevice | undefined>;

export type IsUsbTimeoutError = (error: Error) => boolean;
