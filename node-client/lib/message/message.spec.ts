import { ensureMessage } from './message';

describe('Message module', () => {
  describe('while ensuring message', () => {
    it('should return the message', () => {
      const messageMaybe = {
        type: 'something',
        payload: { other: 'thing' },
      };

      const message = ensureMessage(messageMaybe);

      expect(message).toEqual(messageMaybe);
    });

    it('should throw when not a message', () => {
      expectNotMessage(undefined);
      expectNotMessage(null);
      expectNotMessage({});
      expectNotMessage({ typ: 'something' });
    });

    function expectNotMessage(notMessage: any): void {
      const act = () => ensureMessage(notMessage);
      expect(act).toThrow(new Error('Object is not a message'));
    }
  });
});
