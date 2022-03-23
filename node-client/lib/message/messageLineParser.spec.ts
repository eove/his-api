import {
  MessageLineParser,
  MessageLineParserCreation,
  MessageLineParserEventType,
} from './messageLineParser';

describe('Message line parser', () => {
  let events: any[][] = [];
  let parser: MessageLineParser;

  beforeEach(() => {
    events = [];
  });

  afterEach(() => {
    if (parser) {
      parser.removeAllListeners();
    }
  });

  it('should emit a message from a json line', () => {
    createParser();
    const text = '{"type":"hello","payload":{"name":"joe"}}\n';

    parser.append(text);

    expect(findMessageValues()).toEqual([
      { type: 'hello', payload: { name: 'joe' } },
    ]);
  });

  it("won't emit an empty message", () => {
    createParser();
    const text = '\n';

    parser.append(text);

    expect(findMessageValues()).toEqual([]);
  });

  it('should emit a message after an empty line', () => {
    createParser();

    parser.append('\n');
    parser.append('{"type":"hello"}\n');

    expect(findMessageValues()).toEqual([{ type: 'hello' }]);
  });

  it('should emit a message though starting by end of line', () => {
    createParser();
    const text = '\n{"type":"hello"}\n';

    parser.append(text);

    expect(findMessageValues()).toEqual([{ type: 'hello' }]);
  });

  it('should emit when line is complete', () => {
    createParser();
    parser.append('{"ty');
    parser.append('pe":"is ');
    parser.append('long"}\n');

    expect(findMessageValues()).toEqual([{ type: 'is long' }]);
  });

  it('could emit multiple times for small messages', () => {
    createParser();

    parser.append('{"type":"a"}\n{"type":"b"}\n{"type":"c"}\n');

    expect(findMessageValues()).toEqual([
      { type: 'a' },
      { type: 'b' },
      { type: 'c' },
    ]);
  });

  it('should emit without losing information', () => {
    createParser();

    parser.append('{"type":"hello"}\n{"ty');
    parser.append('pe":"hi"}\n');

    expect(findMessageValues()).toEqual([{ type: 'hello' }, { type: 'hi' }]);
  });

  describe('on overflow', () => {
    it('should emit error', () => {
      createParser({ maxLineLength: 11 });

      parser.append('{"type":"a"');

      expect(findErrorValues()).toHaveLength(0);

      parser.append('}');

      expect(findErrorValues()).toEqual([
        new Error('Overflow error (12 > 11)'),
      ]);
    });

    it('should emit error even on first append', () => {
      createParser({ maxLineLength: 1 });

      parser.append('{"ty');

      expect(findErrorValues()).toEqual([new Error('Overflow error (4 > 1)')]);
    });

    it('should clear current line', () => {
      createParser({ maxLineLength: 13 });

      parser.append('{"type":"hello"');

      parser.append('{"type":"a"}\n');

      expect(findMessageValues()).toEqual([{ type: 'a' }]);
    });
  });

  describe('on parsing error', () => {
    it('should emit error when json cannot be parsed', () => {
      createParser();

      parser.append('notjson\n');

      expect(findErrorValues()).toEqual([
        new Error('Impossible to parse JSON'),
      ]);
    });

    it('should emit error when object is not a message', () => {
      createParser();

      parser.append('{"kind":"hello"}\n');

      expect(findErrorValues()).toEqual([new Error('Object is not a message')]);
    });
  });

  function findErrorValues() {
    return (events || [])
      .filter(([type]) => type === MessageLineParserEventType.error)
      .map(([, error]) => error);
  }

  function findMessageValues() {
    return (events || [])
      .filter(([type]) => type === MessageLineParserEventType.message)
      .map(([, text]) => text);
  }

  function createParser(
    creation: Partial<MessageLineParserCreation> = {}
  ): void {
    parser = new MessageLineParser(
      Object.assign({ maxLineLength: 100 }, creation)
    );
    Object.values(MessageLineParserEventType).forEach((eventName) => {
      parser.on(eventName, (...args) => events.push([eventName, ...args]));
    });
  }
});
