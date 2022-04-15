import { createHisClient, createConsoleLogger } from '../lib';

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main(): Promise<void> {
  const client = createHisClient({
    debugEnabled: process.env.DEBUG === 'true',
  });

  const logger = createConsoleLogger();

  const devices = await client.findDevices();
  if (devices.length === 0) {
    logger.info('No Android device found');
  } else {
    logger.info('Android devices:');
  }

  for (const foundDevice of devices) {
    const { serialNumber } = foundDevice.device;
    console.log(serialNumber);
  }

  process.exit(0);
}
