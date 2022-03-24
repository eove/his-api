import {
  createHisClient,
  ClientEventType,
  createConsoleLogger,
  wait,
  ClientMessageType,
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
  client.on(ClientEventType.messageReceived, onMessageReceived);
  client.on(ClientEventType.messageSent, onMessageSent);
  client.on(ClientEventType.error, onError);
  process.once('SIGINT', onSigint);
  await client.connect();

  async function onConnected() {
    logger.info('Connected');
    await client.writeMessage({
      type: ClientMessageType.startCommunication,
    });
    await client.writeMessage({
      type: ClientMessageType.getInformation,
      reference: '1',
    });
  }

  function onMessageReceived(message: Message) {
    logger.info('<- Receiving', message);
  }

  function onMessageSent(message: Message) {
    logger.info('-> Sending', message);
  }

  function onError(error: Error) {
    logger.error('Error', error);
  }

  async function onSigint() {
    await client.writeMessage({
      type: ClientMessageType.stopCommunication,
    });
    await wait(1000);
    await client.disconnect();
    client.dispose();
  }
}
