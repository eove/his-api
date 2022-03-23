import {
  createHisClient,
  ClientEventType,
  createConsoleLogger,
  wait,
  ClientMessageType,
  SubscriptionChannel,
  Message,
} from '../lib';

main().catch(console.error);

async function main(): Promise<void> {
  const logger = createConsoleLogger();
  const client = createHisClient({
    debugEnabled: process.env.DEBUG === 'true',
    serialNumber: process.env.SERIAL_NUMBER,
  });
  client.on(ClientEventType.connected, onConnected);
  client.on(ClientEventType.message, onMessage);
  client.on(ClientEventType.error, onError);
  process.once('SIGINT', onSigint);
  await client.connect();

  async function onConnected() {
    logger.info('Connected');
    await client.writeMessage({
      type: ClientMessageType.startCommunication,
      payload: undefined,
    });
    await client.writeMessage({
      type: ClientMessageType.subscribe,
      payload: Object.values(SubscriptionChannel),
    });

    if (process.env.UNSUBSCRIBE_MS) {
      await wait(Number.parseInt(process.env.UNSUBSCRIBE_MS, 10));
      await client.writeMessage({
        type: ClientMessageType.unsubscribe,
        payload: Object.values(SubscriptionChannel),
      });
    }
  }

  function onMessage(message: Message) {
    logger.info('Reading', message);
  }

  function onError(error: Error) {
    logger.error('Error', error);
  }

  async function onSigint() {
    await client.writeMessage({
      type: ClientMessageType.stopCommunication,
      payload: undefined,
    });
    await wait(1000);
    await client.disconnect();
    client.dispose();
  }
}
