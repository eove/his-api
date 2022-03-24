import { createHisClient } from '../lib';

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main(): Promise<void> {
  const client = createHisClient({
    debugEnabled: process.env.DEBUG === 'true',
    serialNumber: process.env.SERIAL_NUMBER,
  });
  await client.reset();
  process.exit(0);
}
